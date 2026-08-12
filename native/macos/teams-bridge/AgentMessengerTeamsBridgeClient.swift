import Darwin
import Foundation

private let bridgeLabel = "com.timiaji.agent-messenger-teams-bridge"
private let serverRequirement =
    "anchor apple generic and identifier \"com.timiaji.agent-messenger-teams-bridge\" and certificate leaf[subject.OU] = \"9F4ARQ5FJR\""

@objc protocol TeamsBridgeXPCProtocol {
    func run(_ requestData: Data, withReply reply: @escaping (Data) -> Void)
}

struct BridgeRequest: Codable {
    let version: Int
    let id: String
    let args: [String]
    let profile: String?
    let timeout_ms: Int?
    let input_files: [BridgeInputFile]?
    let output_files: [BridgeOutputFileRequest]?
}

struct BridgeOutputFileRequest: Codable {
    let argument_index: Int
    let filename: String
}

struct BridgeOutputFile: Codable {
    let argument_index: Int
    let filename: String
    let bytes: Data
}

struct BridgeInputFile: Codable {
    let argument_index: Int
    let filename: String
    let bytes: Data
}

struct BridgeResponse: Codable {
    let version: Int
    let id: String
    let exit_code: Int32
    let stdout: String
    let stderr: String
    let output_files: [BridgeOutputFile]?
}

enum FileTransferKind {
    case channelFile
    case chatImage
}

enum FileTransferCommand {
    case input(argumentIndex: Int, kind: FileTransferKind)
    case output(argumentIndex: Int?, insertionIndex: Int, kind: FileTransferKind, identifier: String)
}

func fileTransferCommand(_ args: [String]) -> FileTransferCommand? {
    var positionals: [(index: Int, value: String)] = []
    var optionsEnded = false
    var index = 0
    while index < args.count {
        let value = args[index]
        if !optionsEnded, value == "--" {
            optionsEnded = true
            index += 1
            continue
        }
        if !optionsEnded, value == "--pretty" {
            index += 1
            continue
        }
        if !optionsEnded, value == "--account" || value == "--team" {
            guard index + 1 < args.count else { return nil }
            index += 2
            continue
        }
        if !optionsEnded, value.hasPrefix("--account=") || value.hasPrefix("--team=") {
            guard value.last != "=" else { return nil }
            index += 1
            continue
        }
        positionals.append((index, value))
        index += 1
    }

    guard positionals.count >= 2 else { return nil }
    switch (positionals[0].value, positionals[1].value) {
    case ("file", "upload") where positionals.count == 5:
        return .input(argumentIndex: positionals[4].index, kind: .channelFile)
    case ("chat", "send-image") where positionals.count == 4:
        return .input(argumentIndex: positionals[3].index, kind: .chatImage)
    case ("file", "download") where positionals.count == 5 || positionals.count == 6:
        return .output(
            argumentIndex: positionals.count == 6 ? positionals[5].index : nil,
            insertionIndex: positionals[4].index + 1,
            kind: .channelFile,
            identifier: positionals[4].value
        )
    case ("chat", "download-image") where positionals.count == 3 || positionals.count == 4:
        return .output(
            argumentIndex: positionals.count == 4 ? positionals[3].index : nil,
            insertionIndex: positionals[2].index + 1,
            kind: .chatImage,
            identifier: positionals[2].value
        )
    default:
        return nil
    }
}

func runSelfTest() throws {
    let image = fileTransferCommand(["chat", "--account", "personal", "send-image", "chat", "--pretty", "photo.png"])
    guard case .input(let imageIndex, .chatImage) = image, imageIndex == 6 else {
        throw POSIXError(.EINVAL)
    }
    let upload = fileTransferCommand(["--team=team", "file", "upload", "team", "--account=work", "channel", "--", "--photo.png"])
    guard case .input(let uploadIndex, .channelFile) = upload, uploadIndex == 7 else {
        throw POSIXError(.EINVAL)
    }
    let download = fileTransferCommand(["file", "download", "team", "channel", "file", "--pretty"])
    guard case .output(nil, let insertionIndex, .channelFile, "file") = download, insertionIndex == 5 else {
        throw POSIXError(.EINVAL)
    }

    let temporaryPath = FileManager.default.temporaryDirectory.path
    let physicalTemporaryPath = temporaryPath.hasPrefix("/var/") ? "/private\(temporaryPath)" : temporaryPath
    let root = URL(fileURLWithPath: physicalTemporaryPath, isDirectory: true)
        .appendingPathComponent("teams-bridge-client-self-test-\(UUID().uuidString)", isDirectory: true)
    let directory = root.appendingPathComponent("directory", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: root) }
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let destination = directory.appendingPathComponent("output.bin")
    try writePrivateAtomically(Data("first".utf8), to: destination)
    try writePrivateAtomically(Data("second".utf8), to: destination)
    let attributes = try FileManager.default.attributesOfItem(atPath: destination.path)
    guard try Data(contentsOf: destination) == Data("second".utf8),
          (attributes[.posixPermissions] as? NSNumber)?.intValue == 0o600 else {
        throw POSIXError(.EACCES)
    }
    let symlink = root.appendingPathComponent("symlink", isDirectory: true)
    try FileManager.default.createSymbolicLink(at: symlink, withDestinationURL: directory)
    var rejectedSymlink = false
    do {
        try writePrivateAtomically(Data("blocked".utf8), to: symlink.appendingPathComponent("blocked.bin"))
    } catch {
        rejectedSymlink = true
    }
    guard rejectedSymlink,
          !FileManager.default.fileExists(atPath: directory.appendingPathComponent("blocked.bin").path) else {
        throw POSIXError(.ELOOP)
    }
    print("teams-bridge-client-self-test: pass")
}

if CommandLine.arguments == [CommandLine.arguments[0], "--self-test"] {
    do {
        try runSelfTest()
        exit(0)
    } catch {
        FileHandle.standardError.write(Data("\(error.localizedDescription)\n".utf8))
        exit(1)
    }
}

func openDirectoryWithoutSymlinks(_ url: URL) throws -> Int32 {
    let components = url.pathComponents.filter { $0 != "/" }
    guard url.path.hasPrefix("/"), !components.contains("."), !components.contains("..") else {
        throw POSIXError(.EINVAL)
    }
    var descriptor = open("/", O_RDONLY | O_DIRECTORY | O_CLOEXEC)
    guard descriptor >= 0 else { throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO) }
    do {
        for component in components {
            let next = openat(descriptor, component, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
            guard next >= 0 else { throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO) }
            close(descriptor)
            descriptor = next
        }
        return descriptor
    } catch {
        close(descriptor)
        throw error
    }
}

func destinationURL(_ requested: URL, defaultName: String) throws -> URL {
    do {
        let descriptor = try openDirectoryWithoutSymlinks(requested)
        close(descriptor)
        return requested.appendingPathComponent(defaultName, isDirectory: false)
    } catch let error as POSIXError where error.code == .ENOENT || error.code == .ENOTDIR {
        return requested
    }
}

func writePrivateAtomically(_ data: Data, to destination: URL) throws {
    let parent = destination.deletingLastPathComponent()
    let filename = destination.lastPathComponent
    guard !filename.isEmpty, filename != ".", filename != ".." else { throw POSIXError(.EINVAL) }
    let parentDescriptor = try openDirectoryWithoutSymlinks(parent)
    defer { close(parentDescriptor) }
    let temporary = ".\(filename).\(UUID().uuidString)"
    let fileDescriptor = openat(
        parentDescriptor,
        temporary,
        O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC,
        mode_t(0o600)
    )
    guard fileDescriptor >= 0 else { throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO) }
    var keepTemporary = true
    defer {
        close(fileDescriptor)
        if keepTemporary { unlinkat(parentDescriptor, temporary, 0) }
    }
    try data.withUnsafeBytes { rawBuffer in
        guard let base = rawBuffer.baseAddress else { return }
        var written = 0
        while written < rawBuffer.count {
            let result = Darwin.write(fileDescriptor, base.advanced(by: written), rawBuffer.count - written)
            if result < 0, errno == EINTR { continue }
            guard result > 0 else { throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO) }
            written += result
        }
    }
    guard fchmod(fileDescriptor, mode_t(0o600)) == 0, fsync(fileDescriptor) == 0 else {
        throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
    }
    guard renameat(parentDescriptor, temporary, parentDescriptor, filename) == 0 else {
        throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
    }
    keepTemporary = false
    guard fsync(parentDescriptor) == 0 else { throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO) }
}

let profile = ProcessInfo.processInfo.environment["AGENT_TEAMS_BRIDGE_PROFILE"] ?? "live"
guard profile == "live" || profile == "proof" else {
    FileHandle.standardError.write(Data("AGENT_TEAMS_BRIDGE_PROFILE must be live or proof.\n".utf8))
    exit(64)
}
let requestID = UUID().uuidString.lowercased()
var cliArgs = Array(CommandLine.arguments.dropFirst())
var inputFiles: [BridgeInputFile] = []
var outputFiles: [BridgeOutputFileRequest] = []
var requestedOutputURL: URL?
var outputKind: FileTransferKind?
var outputIdentifier: String?
var outputWasProvided = false
switch fileTransferCommand(cliArgs) {
case .input(let argumentIndex, let kind):
    let fileURL = URL(fileURLWithPath: cliArgs[argumentIndex]).standardizedFileURL
    let values = try? fileURL.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey])
    guard values?.isRegularFile == true, let size = values?.fileSize, size <= 20 * 1_024 * 1_024,
          let bytes = try? Data(contentsOf: fileURL, options: [.mappedIfSafe]) else {
        let message = kind == .chatImage
            ? "Teams chat image requires a readable file no larger than 20 MiB.\n"
            : "Teams file upload requires a readable regular file no larger than 20 MiB.\n"
        FileHandle.standardError.write(Data(message.utf8))
        exit(66)
    }
    cliArgs[argumentIndex] = fileURL.lastPathComponent
    inputFiles.append(BridgeInputFile(argument_index: argumentIndex, filename: fileURL.lastPathComponent, bytes: bytes))
case .output(let existingArgumentIndex, let insertionIndex, let kind, let identifier):
    let outputIndex: Int
    if let existingArgumentIndex {
        outputIndex = existingArgumentIndex
        requestedOutputURL = URL(fileURLWithPath: cliArgs[existingArgumentIndex]).standardizedFileURL
        cliArgs[existingArgumentIndex] = "download-output"
        outputWasProvided = true
    } else {
        requestedOutputURL = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        outputIndex = insertionIndex
        cliArgs.insert("download-output", at: outputIndex)
    }
    outputKind = kind
    outputIdentifier = identifier
    outputFiles.append(BridgeOutputFileRequest(argument_index: outputIndex, filename: "download-output"))
case nil:
    break
}

let request = BridgeRequest(
    version: 1,
    id: requestID,
    args: cliArgs,
    profile: profile,
    timeout_ms: 90_000,
    input_files: inputFiles.isEmpty ? nil : inputFiles,
    output_files: outputFiles.isEmpty ? nil : outputFiles
)
guard let requestData = try? JSONEncoder().encode(request), requestData.count <= 28 * 1_024 * 1_024 else {
    FileHandle.standardError.write(Data("Teams bridge request is too large.\n".utf8))
    exit(64)
}

let connection = NSXPCConnection(machServiceName: bridgeLabel, options: [])
connection.remoteObjectInterface = NSXPCInterface(with: TeamsBridgeXPCProtocol.self)
connection.setCodeSigningRequirement(serverRequirement)
let completion = DispatchSemaphore(value: 0)
var responseData: Data?
var connectionError: Error?
connection.invalidationHandler = { completion.signal() }
connection.interruptionHandler = { completion.signal() }
connection.resume()

guard let proxy = connection.remoteObjectProxyWithErrorHandler({ error in
    connectionError = error
    completion.signal()
}) as? TeamsBridgeXPCProtocol else {
    FileHandle.standardError.write(Data("Teams bridge service is unavailable.\n".utf8))
    exit(69)
}
proxy.run(requestData) { data in
    responseData = data
    completion.signal()
}

guard completion.wait(timeout: .now() + .seconds(300)) == .success else {
    connection.invalidate()
    FileHandle.standardError.write(Data("Teams bridge did not respond within 300 seconds.\n".utf8))
    exit(124)
}
connection.invalidate()
if let connectionError {
    FileHandle.standardError.write(Data("Teams bridge connection failed: \(connectionError.localizedDescription)\n".utf8))
    exit(69)
}
guard
    let responseData,
    responseData.count <= 32 * 1_024 * 1_024,
    let response = try? JSONDecoder().decode(BridgeResponse.self, from: responseData),
    response.version == 1,
    response.id == requestID
else {
    FileHandle.standardError.write(Data("Teams bridge returned an invalid response.\n".utf8))
    exit(70)
}
if response.exit_code != 0 {
    if !response.stdout.isEmpty { FileHandle.standardOutput.write(Data(response.stdout.utf8)) }
    if !response.stderr.isEmpty { FileHandle.standardError.write(Data(response.stderr.utf8)) }
    exit(response.exit_code)
}
guard requestedOutputURL == nil ? (response.output_files?.isEmpty ?? true) : response.output_files?.count == 1 else {
    FileHandle.standardError.write(Data("Teams bridge returned an invalid image output count.\n".utf8))
    exit(70)
}
var stdout = response.stdout
if let output = response.output_files?.first, let requestedOutputURL, let outputKind, let outputIdentifier {
    guard response.output_files?.count == 1, output.argument_index == outputFiles.first?.argument_index,
          output.filename == outputFiles.first?.filename,
          output.bytes.count <= 20 * 1_024 * 1_024,
          outputKind == .channelFile || !output.bytes.isEmpty else {
        FileHandle.standardError.write(Data("Teams bridge returned an invalid file output.\n".utf8))
        exit(70)
    }
    let defaultName: String
    switch outputKind {
    case .chatImage:
        let imageExtension: String
        if output.bytes.starts(with: [137, 80, 78, 71, 13, 10, 26, 10]) {
            imageExtension = "png"
        } else if output.bytes.starts(with: [255, 216, 255]) {
            imageExtension = "jpg"
        } else {
            FileHandle.standardError.write(Data("Teams bridge returned an image with an invalid signature.\n".utf8))
            exit(70)
        }
        defaultName = "\(outputIdentifier).\(imageExtension)"
    case .channelFile:
        guard let outputJSON = try? JSONSerialization.jsonObject(with: Data(stdout.utf8)) as? [String: Any],
              let name = outputJSON["name"] as? String else {
            FileHandle.standardError.write(Data("Teams bridge returned invalid file download output.\n".utf8))
            exit(70)
        }
        let safeName = URL(fileURLWithPath: name.replacingOccurrences(of: "\\", with: "/")).lastPathComponent
        guard !safeName.isEmpty, safeName != ".", safeName != ".." else {
            FileHandle.standardError.write(Data("Teams bridge returned an invalid file name.\n".utf8))
            exit(70)
        }
        defaultName = safeName
    }
    do {
        let destination = try destinationURL(requestedOutputURL, defaultName: defaultName)
        let finalDestination = outputWasProvided ? destination : requestedOutputURL.appendingPathComponent(defaultName)
        try writePrivateAtomically(output.bytes, to: finalDestination)
        guard var outputJSON = try? JSONSerialization.jsonObject(with: Data(stdout.utf8)) as? [String: Any] else {
            FileHandle.standardError.write(Data("Teams bridge returned invalid download output.\n".utf8))
            exit(70)
        }
        outputJSON["path"] = finalDestination.path
        guard let rewrittenJSON = try? JSONSerialization.data(withJSONObject: outputJSON),
              let rewrittenStdout = String(data: rewrittenJSON, encoding: .utf8) else {
            FileHandle.standardError.write(Data("Teams bridge could not encode download output.\n".utf8))
            exit(70)
        }
        stdout = rewrittenStdout + "\n"
    } catch {
        FileHandle.standardError.write(Data("Unable to write Teams download: \(error.localizedDescription)\n".utf8))
        exit(74)
    }
}
if !stdout.isEmpty { FileHandle.standardOutput.write(Data(stdout.utf8)) }
if !response.stderr.isEmpty { FileHandle.standardError.write(Data(response.stderr.utf8)) }
exit(response.exit_code)
