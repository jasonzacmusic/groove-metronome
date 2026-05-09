import SwiftUI

@main
struct GrooveWatchApp: App {
    @StateObject private var metronome = WatchMetronome()

    var body: some Scene {
        WindowGroup {
            WatchMetronomeView()
                .environmentObject(metronome)
        }
    }
}
