import Foundation
import WatchKit

@MainActor
final class WatchMetronome: ObservableObject {
    @Published var bpm: Double = 120
    @Published var beatsPerBar: Int = 4
    @Published var currentBeat: Int = 0
    @Published var isPlaying = false
    @Published var hapticsEnabled = true

    private var timer: Timer?

    var tempoLabel: String {
        switch bpm {
        case ..<76: return "Andante"
        case ..<108: return "Moderato"
        case ..<132: return "Allegro"
        case ..<168: return "Vivace"
        default: return "Presto"
        }
    }

    func toggle() {
        isPlaying ? stop() : start()
    }

    func setBpm(_ next: Double) {
        bpm = min(240, max(40, next.rounded()))
        if isPlaying {
            start()
        }
    }

    func adjustBpm(_ amount: Double) {
        setBpm(bpm + amount)
    }

    func start() {
        timer?.invalidate()
        isPlaying = true
        currentBeat = 0
        pulse()
        timer = Timer.scheduledTimer(withTimeInterval: 60 / bpm, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.advance()
            }
        }
        if let timer {
            RunLoop.main.add(timer, forMode: .common)
        }
    }

    func stop() {
        timer?.invalidate()
        timer = nil
        isPlaying = false
        currentBeat = 0
    }

    private func advance() {
        currentBeat = (currentBeat + 1) % beatsPerBar
        pulse()
    }

    private func pulse() {
        guard hapticsEnabled else { return }
        WKInterfaceDevice.current().play(currentBeat == 0 ? .directionUp : .click)
    }
}
