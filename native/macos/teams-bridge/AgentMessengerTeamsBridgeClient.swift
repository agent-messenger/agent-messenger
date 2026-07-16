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
}

struct BridgeResponse: Codable {
    let version: Int
    let id: String
    let exit_code: Int32
    let stdout: String
    let stderr: String
}

let profile = ProcessInfo.processInfo.environment["AGENT_TEAMS_BRIDGE_PROFILE"] ?? "live"
guard profile == "live" || profile == "proof" else {
    FileHandle.standardError.write(Data("AGENT_TEAMS_BRIDGE_PROFILE must be live or proof.\n".utf8))
    exit(64)
}
let requestID = UUID().uuidString.lowercased()
let request = BridgeRequest(
    version: 1,
    id: requestID,
    args: Array(CommandLine.arguments.dropFirst()),
    profile: profile,
    timeout_ms: 90_000
)
guard let requestData = try? JSONEncoder().encode(request), requestData.count <= 1_048_576 else {
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
    let response = try? JSONDecoder().decode(BridgeResponse.self, from: responseData),
    response.version == 1,
    response.id == requestID
else {
    FileHandle.standardError.write(Data("Teams bridge returned an invalid response.\n".utf8))
    exit(70)
}
if !response.stdout.isEmpty { FileHandle.standardOutput.write(Data(response.stdout.utf8)) }
if !response.stderr.isEmpty { FileHandle.standardError.write(Data(response.stderr.utf8)) }
exit(response.exit_code)
