import AppKit
import CommonCrypto
import Darwin
import Foundation
import Security
import SQLite3

private let bridgeLabel = "com.timiaji.agent-messenger-teams-bridge"
private let clientRequirement =
    "anchor apple generic and identifier \"com.timiaji.agent-messenger-teams-bridge-client\" and certificate leaf[subject.OU] = \"9F4ARQ5FJR\""

@objc private protocol TeamsBridgeXPCProtocol {
    func run(_ requestData: Data, withReply reply: @escaping (Data) -> Void)
}

private struct BridgeRequest: Codable {
    let version: Int
    let id: String
    let args: [String]
    let profile: String?
    let timeout_ms: Int?
}

private struct BridgeResponse: Codable {
    let version: Int
    let id: String
    let exit_code: Int32
    let stdout: String
    let stderr: String
}

private enum BridgeError: LocalizedError {
    case invalidRequest(String)
    case setupRequired(String)
    case stagingFailed(String)
    case runtimeFailed(String)

    var errorDescription: String? {
        switch self {
        case .invalidRequest(let message), .setupRequired(let message), .stagingFailed(let message),
             .runtimeFailed(let message):
            return message
        }
    }
}

private final class BridgePaths {
    let support: URL
    let caches: URL
    let bookmark: URL
    let staging: URL
    let liveConfig: URL
    let proofConfig: URL

    init() {
        let applicationSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let cachesDirectory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        support = applicationSupport.appendingPathComponent("Agent Messenger Teams Bridge", isDirectory: true)
        caches = cachesDirectory.appendingPathComponent("Agent Messenger Teams Bridge", isDirectory: true)
        bookmark = support.appendingPathComponent("teams-ebwebview.bookmark")
        staging = caches.appendingPathComponent("staging", isDirectory: true)
        liveConfig = support.appendingPathComponent("live", isDirectory: true)
        proofConfig = support.appendingPathComponent("proof", isDirectory: true)
    }

    func prepare() throws {
        for directory in [support, caches, staging, liveConfig, proofConfig] {
            try ensureDirectory(directory)
        }
        for abandoned in try FileManager.default.contentsOfDirectory(at: staging, includingPropertiesForKeys: nil) {
            try? FileManager.default.removeItem(at: abandoned)
        }
    }
}

private func ensureDirectory(_ url: URL) throws {
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    guard chmod(url.path, mode_t(0o700)) == 0 else { throw POSIXError(.EACCES) }
}

private func writePrivate(_ data: Data, to url: URL) throws {
    try ensureDirectory(url.deletingLastPathComponent())
    let temporary = url.deletingLastPathComponent().appendingPathComponent(".\(url.lastPathComponent).\(UUID().uuidString)")
    try data.write(to: temporary, options: .atomic)
    guard chmod(temporary.path, mode_t(0o600)) == 0 else {
        try? FileManager.default.removeItem(at: temporary)
        throw POSIXError(.EACCES)
    }
    try? FileManager.default.removeItem(at: url)
    try FileManager.default.moveItem(at: temporary, to: url)
}

private func actualHomeDirectory() throws -> URL {
    guard let passwordEntry = getpwuid(getuid()), let path = passwordEntry.pointee.pw_dir else {
        throw BridgeError.setupRequired("Unable to resolve the signed-in user's home directory.")
    }
    return URL(fileURLWithPath: String(cString: path), isDirectory: true)
}

private func isSafeIdentifier(_ value: String) -> Bool {
    guard !value.isEmpty, value.count <= 64 else { return false }
    return value.unicodeScalars.allSatisfy {
        CharacterSet.alphanumerics.contains($0) || $0 == "-" || $0 == "_"
    }
}

private func validatedArgs(_ request: BridgeRequest) throws -> [String] {
    guard request.version == 1, isSafeIdentifier(request.id) else {
        throw BridgeError.invalidRequest("Invalid Teams bridge request identity.")
    }
    guard !request.args.isEmpty, request.args.count <= 64 else {
        throw BridgeError.invalidRequest("Invalid Teams bridge argument count.")
    }
    guard request.args.allSatisfy({ $0.utf8.count <= 16_384 && !$0.contains("\0") }) else {
        throw BridgeError.invalidRequest("Invalid Teams bridge argument payload.")
    }
    if request.args.starts(with: ["auth", "login"]) {
        throw BridgeError.invalidRequest("Teams device-code login is disabled; the official desktop app owns sign-in.")
    }
    if request.args.contains("--token") || request.args.contains(where: { $0.hasPrefix("--token=") }) {
        throw BridgeError.invalidRequest("Manual Teams token input is disabled.")
    }
    if request.args.contains("--browser-profile") || request.args.contains(where: { $0.hasPrefix("--browser-profile=") }) {
        throw BridgeError.invalidRequest("Browser-profile Teams extraction is disabled.")
    }

    var args = request.args
    if args.starts(with: ["auth", "extract"]) {
        if let index = args.firstIndex(of: "--source"), index + 1 < args.count, args[index + 1] != "desktop" {
            throw BridgeError.invalidRequest("Only the desktop Teams authentication source is allowed.")
        }
        if let inline = args.first(where: { $0.hasPrefix("--source=") }), inline != "--source=desktop" {
            throw BridgeError.invalidRequest("Only the desktop Teams authentication source is allowed.")
        }
        if !args.contains("--source") && !args.contains(where: { $0.hasPrefix("--source=") }) {
            args.append(contentsOf: ["--source", "desktop"])
        }
    }
    return args
}

private func selectedConfigDirectory(for request: BridgeRequest, paths: BridgePaths) throws -> URL {
    switch request.profile ?? "live" {
    case "live": return paths.liveConfig
    case "proof": return paths.proofConfig
    default: throw BridgeError.invalidRequest("Unknown Teams bridge profile.")
    }
}

private final class TeamsSourceAccess {
    private let paths: BridgePaths
    private var activeURL: URL?
    private var startedSecurityScope = false

    init(paths: BridgePaths) {
        self.paths = paths
    }

    deinit {
        if startedSecurityScope { activeURL?.stopAccessingSecurityScopedResource() }
    }

    func resolveExisting() -> URL? {
        if let activeURL { return activeURL }
        guard FileManager.default.fileExists(atPath: paths.bookmark.path) else { return nil }
        do {
            let data = try Data(contentsOf: paths.bookmark)
            var stale = false
            let url = try URL(
                resolvingBookmarkData: data,
                options: [.withSecurityScope, .withoutUI],
                relativeTo: nil,
                bookmarkDataIsStale: &stale
            )
            let started = url.startAccessingSecurityScopedResource()
            try validate(url)
            if stale { try persistBookmark(for: url) }
            activeURL = url
            startedSecurityScope = started
            return url
        } catch {
            return nil
        }
    }

    @MainActor
    func resolveOrRequest() throws -> URL {
        if let activeURL { return activeURL }
        if let existing = resolveExisting() { return existing }

        NSApp.activate(ignoringOtherApps: true)
        let panel = NSOpenPanel()
        panel.title = "Allow Agent Messenger to use your Teams desktop sessions"
        panel.message = "Select the EBWebView folder. The companion receives read-only access to the two sessions already signed in inside Microsoft Teams."
        panel.prompt = "Grant Access"
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        panel.canCreateDirectories = false
        panel.resolvesAliases = true
        panel.directoryURL = try actualHomeDirectory().appendingPathComponent(
            "Library/Containers/com.microsoft.teams2/Data/Library/Application Support/Microsoft/MSTeams/EBWebView",
            isDirectory: true
        )
        guard panel.runModal() == .OK, let url = panel.url else {
            throw BridgeError.setupRequired("Teams desktop access was not granted.")
        }
        try validate(url)
        try persistBookmark(for: url)
        startedSecurityScope = url.startAccessingSecurityScopedResource()
        activeURL = url
        return url
    }

    private func validate(_ url: URL) throws {
        guard url.lastPathComponent == "EBWebView" else {
            throw BridgeError.setupRequired("Select Microsoft Teams' EBWebView folder, not a broader folder.")
        }
        _ = try FileManager.default.contentsOfDirectory(at: url, includingPropertiesForKeys: nil)
    }

    private func persistBookmark(for url: URL) throws {
        let data = try url.bookmarkData(
            options: [.withSecurityScope],
            includingResourceValuesForKeys: nil,
            relativeTo: nil
        )
        try writePrivate(data, to: paths.bookmark)
    }
}

private let keychainVariants = [
    ("Microsoft Teams Safe Storage", "Microsoft Teams"),
    ("Microsoft Teams (work or school) Safe Storage", "Microsoft Teams (work or school)"),
    ("Teams Safe Storage", "Teams"),
]

private func deriveTeamsKey(from passwordData: Data) throws -> Data {
    let password = String(decoding: passwordData, as: UTF8.self)
    let salt = Array("saltysalt".utf8)
    var derived = [UInt8](repeating: 0, count: 16)
    let result = password.withCString { passwordPointer in
        salt.withUnsafeBytes { saltBytes in
            CCKeyDerivationPBKDF(
                CCPBKDFAlgorithm(kCCPBKDF2),
                passwordPointer,
                password.utf8.count,
                saltBytes.bindMemory(to: UInt8.self).baseAddress,
                salt.count,
                CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA1),
                1003,
                &derived,
                derived.count
            )
        }
    }
    guard result == kCCSuccess else {
        throw BridgeError.runtimeFailed("Unable to derive the Teams desktop decryption key.")
    }
    return Data(derived)
}

private func ensureDerivedTeamsKey(configDirectory: URL, forceRefresh: Bool = false) throws {
    let keyPath = configDirectory.appendingPathComponent(".derived-keys/teams.key")
    if !forceRefresh, let existing = try? Data(contentsOf: keyPath), existing.count == 16 { return }
    if forceRefresh { try? FileManager.default.removeItem(at: keyPath) }

    for (service, account) in keychainVariants {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { continue }
        guard status == errSecSuccess, let passwordData = item as? Data else {
            throw BridgeError.setupRequired("Microsoft Teams Safe Storage access was not granted (Keychain status \(status)).")
        }
        try writePrivate(try deriveTeamsKey(from: passwordData), to: keyPath)
        return
    }
    throw BridgeError.setupRequired("Microsoft Teams Safe Storage was not found in Keychain.")
}

private func findCookieDatabase(in profile: URL) throws -> URL {
    let direct = [profile.appendingPathComponent("Network/Cookies"), profile.appendingPathComponent("Cookies")]
    if let match = direct.first(where: { FileManager.default.fileExists(atPath: $0.path) }) { return match }
    guard let enumerator = FileManager.default.enumerator(
        at: profile,
        includingPropertiesForKeys: [.isRegularFileKey],
        options: [.skipsHiddenFiles, .skipsPackageDescendants]
    ) else {
        throw BridgeError.stagingFailed("Unable to inspect Teams profile \(profile.lastPathComponent).")
    }
    var matches: [URL] = []
    for case let candidate as URL in enumerator where candidate.lastPathComponent == "Cookies" {
        if candidate.pathComponents.count - profile.pathComponents.count <= 4 { matches.append(candidate) }
    }
    guard let match = matches.sorted(by: { $0.path < $1.path }).first else {
        throw BridgeError.stagingFailed("No cookie database found for Teams profile \(profile.lastPathComponent).")
    }
    return match
}

private func snapshotSQLiteDatabase(_ source: URL, to destination: URL) throws {
    try ensureDirectory(destination.deletingLastPathComponent())
    try? FileManager.default.removeItem(at: destination)

    var sourceDatabase: OpaquePointer?
    var destinationDatabase: OpaquePointer?
    guard sqlite3_open_v2(source.path, &sourceDatabase, SQLITE_OPEN_READONLY | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK,
          let sourceDatabase else {
        if let sourceDatabase { sqlite3_close(sourceDatabase) }
        throw BridgeError.stagingFailed("Unable to open Teams' live cookie database read-only.")
    }
    defer { sqlite3_close(sourceDatabase) }
    guard sqlite3_open_v2(
        destination.path,
        &destinationDatabase,
        SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX,
        nil
    ) == SQLITE_OK, let destinationDatabase else {
        if let destinationDatabase { sqlite3_close(destinationDatabase) }
        throw BridgeError.stagingFailed("Unable to create the private Teams cookie snapshot.")
    }
    defer { sqlite3_close(destinationDatabase) }
    sqlite3_busy_timeout(sourceDatabase, 2_000)
    sqlite3_busy_timeout(destinationDatabase, 2_000)

    guard let backup = sqlite3_backup_init(destinationDatabase, "main", sourceDatabase, "main") else {
        throw BridgeError.stagingFailed("Unable to start a consistent Teams cookie snapshot.")
    }
    var result = SQLITE_OK
    var contentionRetries = 0
    repeat {
        result = sqlite3_backup_step(backup, 64)
        if result == SQLITE_BUSY || result == SQLITE_LOCKED {
            contentionRetries += 1
            if contentionRetries > 80 { break }
            sqlite3_sleep(25)
        }
    } while result == SQLITE_OK || result == SQLITE_BUSY || result == SQLITE_LOCKED
    let finishResult = sqlite3_backup_finish(backup)
    guard result == SQLITE_DONE, finishResult == SQLITE_OK else {
        throw BridgeError.stagingFailed("Teams' cookie database stayed busy; no inconsistent snapshot was used.")
    }
    guard chmod(destination.path, mode_t(0o600)) == 0 else { throw POSIXError(.EACCES) }
}

private func stageTeamsProfiles(sourceRoot: URL, paths: BridgePaths, requestID: String) throws -> URL {
    let destinationRoot = paths.staging.appendingPathComponent(requestID, isDirectory: true)
    try? FileManager.default.removeItem(at: destinationRoot)
    try ensureDirectory(destinationRoot)
    do {
        for profileName in ["WV2Profile_tfw", "WV2Profile_tfl"] {
            let sourceCookies = try findCookieDatabase(
                in: sourceRoot.appendingPathComponent(profileName, isDirectory: true)
            )
            let destinationCookies = destinationRoot
                .appendingPathComponent(profileName, isDirectory: true)
                .appendingPathComponent("Network/Cookies")
            try snapshotSQLiteDatabase(sourceCookies, to: destinationCookies)
        }
        let localState = sourceRoot.appendingPathComponent("Local State")
        if FileManager.default.fileExists(atPath: localState.path) {
            try writePrivate(try Data(contentsOf: localState), to: destinationRoot.appendingPathComponent("Local State"))
        }
        return destinationRoot
    } catch {
        try? FileManager.default.removeItem(at: destinationRoot)
        throw error
    }
}

private func runAgentTeams(
    args: [String],
    configDirectory: URL,
    stagedRoot: URL,
    timeoutMilliseconds: Int
) throws -> (Int32, String, String) {
    guard let resources = Bundle.main.resourceURL else {
        throw BridgeError.runtimeFailed("Teams bridge resources are unavailable.")
    }
    let bun = resources.appendingPathComponent("runtime/bun")
    let launcher = resources.appendingPathComponent("runtime/launcher")
    let agentRoot = resources.appendingPathComponent("agent-messenger", isDirectory: true)
    let cli = agentRoot.appendingPathComponent("dist/src/platforms/teams/cli.js")
    guard FileManager.default.isExecutableFile(atPath: bun.path),
          FileManager.default.isExecutableFile(atPath: launcher.path),
          FileManager.default.fileExists(atPath: cli.path) else {
        throw BridgeError.runtimeFailed("The embedded Agent Messenger runtime is incomplete.")
    }

    let process = Process()
    process.executableURL = launcher
    process.arguments = [bun.path, cli.path] + args
    process.currentDirectoryURL = agentRoot
    process.environment = [
        "HOME": configDirectory.path,
        "TMPDIR": NSTemporaryDirectory(),
        "PATH": "/usr/bin:/bin:/usr/sbin:/sbin",
        "LANG": "en_GB.UTF-8",
        "LC_ALL": "en_GB.UTF-8",
        "NO_COLOR": "1",
        "AGENT_MESSENGER_CONFIG_DIR": configDirectory.path,
        "AGENT_TEAMS_AUTH_SOURCE": "desktop",
        "AGENT_TEAMS_COMPANION_MEDIATED": "1",
        "AGENT_TEAMS_DESKTOP_PROFILE_ROOT": stagedRoot.path,
        "AGENT_TEAMS_DISABLE_KEYCHAIN_LOOKUP": "1",
    ]

    let outputPipe = Pipe()
    let errorPipe = Pipe()
    process.standardOutput = outputPipe
    process.standardError = errorPipe
    try process.run()

    let readGroup = DispatchGroup()
    let lock = NSLock()
    var stdoutData = Data()
    var stderrData = Data()
    var outputExceeded = false
    let outputLimit = 4 * 1_024 * 1_024
    let processGroup = process.processIdentifier
    func collect(_ handle: FileHandle, intoStdout: Bool) {
        readGroup.enter()
        DispatchQueue.global(qos: .utility).async {
            defer { readGroup.leave() }
            while let chunk = try? handle.read(upToCount: 64 * 1_024), !chunk.isEmpty {
                lock.lock()
                if stdoutData.count + stderrData.count + chunk.count > outputLimit {
                    outputExceeded = true
                    lock.unlock()
                    kill(-processGroup, SIGKILL)
                    break
                }
                if intoStdout { stdoutData.append(chunk) } else { stderrData.append(chunk) }
                lock.unlock()
            }
        }
    }
    collect(outputPipe.fileHandleForReading, intoStdout: true)
    collect(errorPipe.fileHandleForReading, intoStdout: false)

    let completion = DispatchSemaphore(value: 0)
    DispatchQueue.global(qos: .userInitiated).async { process.waitUntilExit(); completion.signal() }
    let boundedTimeout = min(max(timeoutMilliseconds, 5_000), 120_000)
    if completion.wait(timeout: .now() + .milliseconds(boundedTimeout)) == .timedOut {
        kill(-processGroup, SIGTERM)
        if completion.wait(timeout: .now() + .seconds(2)) == .timedOut {
            kill(-processGroup, SIGKILL)
            _ = completion.wait(timeout: .now() + .seconds(5))
        }
        _ = readGroup.wait(timeout: .now() + .seconds(2))
        return (124, String(data: stdoutData, encoding: .utf8) ?? "", "Teams bridge request timed out.\n")
    }
    _ = readGroup.wait(timeout: .now() + .seconds(2))
    guard !outputExceeded else {
        throw BridgeError.runtimeFailed("Teams bridge response exceeded the 4 MiB safety limit.")
    }
    return (
        process.terminationStatus,
        String(data: stdoutData, encoding: .utf8) ?? "",
        String(data: stderrData, encoding: .utf8) ?? ""
    )
}

private final class TeamsBridgeService: NSObject, TeamsBridgeXPCProtocol {
    private let paths: BridgePaths
    private let sourceAccess: TeamsSourceAccess
    private let queue = DispatchQueue(label: "com.timiaji.agent-messenger-teams-bridge.requests")

    init(paths: BridgePaths, sourceAccess: TeamsSourceAccess) {
        self.paths = paths
        self.sourceAccess = sourceAccess
    }

    func run(_ requestData: Data, withReply reply: @escaping (Data) -> Void) {
        queue.async {
            let response: BridgeResponse
            var responseID = "invalid"
            var stagedRoot: URL?
            do {
                guard requestData.count <= 1_048_576 else {
                    throw BridgeError.invalidRequest("Teams bridge request exceeded the 1 MiB safety limit.")
                }
                let request = try JSONDecoder().decode(BridgeRequest.self, from: requestData)
                responseID = request.id
                let args = try validatedArgs(request)
                let config = try selectedConfigDirectory(for: request, paths: self.paths)
                let sourceRoot: URL
                if let existing = self.sourceAccess.resolveExisting() {
                    sourceRoot = existing
                } else {
                    sourceRoot = try DispatchQueue.main.sync {
                        try MainActor.assumeIsolated { try self.sourceAccess.resolveOrRequest() }
                    }
                }
                try ensureDerivedTeamsKey(configDirectory: config)
                let stage = try stageTeamsProfiles(sourceRoot: sourceRoot, paths: self.paths, requestID: request.id)
                stagedRoot = stage
                var result = try runAgentTeams(
                    args: args,
                    configDirectory: config,
                    stagedRoot: stage,
                    timeoutMilliseconds: request.timeout_ms ?? 90_000
                )
                if result.0 != 0 && result.2.contains("AGENT_TEAMS_CACHED_KEY_REJECTED") {
                    try ensureDerivedTeamsKey(configDirectory: config, forceRefresh: true)
                    result = try runAgentTeams(
                        args: args,
                        configDirectory: config,
                        stagedRoot: stage,
                        timeoutMilliseconds: request.timeout_ms ?? 90_000
                    )
                }
                response = BridgeResponse(version: 1, id: request.id, exit_code: result.0, stdout: result.1, stderr: result.2)
            } catch {
                response = BridgeResponse(
                    version: 1,
                    id: responseID,
                    exit_code: 70,
                    stdout: "",
                    stderr: "\(error.localizedDescription)\n"
                )
            }
            if let stagedRoot { try? FileManager.default.removeItem(at: stagedRoot) }
            reply((try? JSONEncoder().encode(response)) ?? Data())
        }
    }
}

private final class ListenerDelegate: NSObject, NSXPCListenerDelegate {
    private let service: TeamsBridgeService

    init(service: TeamsBridgeService) {
        self.service = service
    }

    func listener(_ listener: NSXPCListener, shouldAcceptNewConnection connection: NSXPCConnection) -> Bool {
        guard connection.effectiveUserIdentifier == getuid() else { return false }
        connection.setCodeSigningRequirement(clientRequirement)
        connection.exportedInterface = NSXPCInterface(with: TeamsBridgeXPCProtocol.self)
        connection.exportedObject = service
        connection.resume()
        return true
    }
}

private final class BridgeDelegate: NSObject, NSApplicationDelegate {
    private var listener: NSXPCListener?
    private var listenerDelegate: ListenerDelegate?
    private var sourceAccess: TeamsSourceAccess?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        do {
            let paths = BridgePaths()
            try paths.prepare()
            let access = TeamsSourceAccess(paths: paths)
            _ = access.resolveExisting()
            let service = TeamsBridgeService(paths: paths, sourceAccess: access)
            let delegate = ListenerDelegate(service: service)
            let listener = NSXPCListener(machServiceName: bridgeLabel)
            listener.delegate = delegate
            listener.resume()
            sourceAccess = access
            listenerDelegate = delegate
            self.listener = listener
        } catch {
            // Stay stopped on a deterministic startup failure. launchd does not KeepAlive this app.
            NSApp.terminate(nil)
        }
    }
}

private func runSelfTest() throws {
    let valid = BridgeRequest(version: 1, id: "self-test", args: ["auth", "extract"], profile: "proof", timeout_ms: 5_000)
    guard try validatedArgs(valid).suffix(2) == ["--source", "desktop"] else {
        throw BridgeError.invalidRequest("Desktop source injection failed.")
    }
    let invalid = BridgeRequest(version: 1, id: "self-test", args: ["auth", "login"], profile: "proof", timeout_ms: 5_000)
    do {
        _ = try validatedArgs(invalid)
        throw BridgeError.invalidRequest("Device-code guard failed.")
    } catch BridgeError.invalidRequest {
        // Expected.
    }
    print("teams-bridge-self-test: pass")
}

if CommandLine.arguments.contains("--self-test") {
    do {
        try runSelfTest()
        exit(0)
    } catch {
        FileHandle.standardError.write(Data("\(error.localizedDescription)\n".utf8))
        exit(1)
    }
}

private let application = NSApplication.shared
private let delegate = BridgeDelegate()
application.delegate = delegate
application.run()
