import SwiftUI

struct WatchMetronomeView: View {
    @EnvironmentObject private var metronome: WatchMetronome
    @FocusState private var crownFocused: Bool

    var body: some View {
        VStack(spacing: 8) {
            ZStack {
                PulseRing(
                    beats: metronome.beatsPerBar,
                    currentBeat: metronome.currentBeat,
                    isPlaying: metronome.isPlaying
                )
                VStack(spacing: 0) {
                    Text("\(Int(metronome.bpm))")
                        .font(.system(size: 42, weight: .semibold, design: .serif))
                        .monospacedDigit()
                    Text(metronome.tempoLabel.uppercased())
                        .font(.system(size: 9, weight: .medium, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .tracking(2)
                }
            }
            .frame(height: 116)
            .focusable()
            .focused($crownFocused)
            .digitalCrownRotation(
                Binding(
                    get: { metronome.bpm },
                    set: { metronome.setBpm($0) }
                ),
                from: 40,
                through: 240,
                by: 1,
                sensitivity: .medium,
                isContinuous: false,
                isHapticFeedbackEnabled: true
            )

            HStack(spacing: 8) {
                Button {
                    metronome.adjustBpm(-1)
                } label: {
                    Image(systemName: "minus")
                }
                .buttonStyle(.bordered)

                Button {
                    metronome.toggle()
                } label: {
                    Image(systemName: metronome.isPlaying ? "stop.fill" : "play.fill")
                        .font(.system(size: 18, weight: .bold))
                }
                .buttonStyle(.borderedProminent)
                .tint(.yellow)

                Button {
                    metronome.adjustBpm(1)
                } label: {
                    Image(systemName: "plus")
                }
                .buttonStyle(.bordered)
            }

            Toggle(isOn: $metronome.hapticsEnabled) {
                Text("Haptics")
                    .font(.system(size: 10, weight: .medium, design: .monospaced))
            }
            .tint(.yellow)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .onAppear {
            crownFocused = true
        }
    }
}

private struct PulseRing: View {
    let beats: Int
    let currentBeat: Int
    let isPlaying: Bool

    var body: some View {
        ZStack {
            Circle()
                .stroke(.white.opacity(0.12), lineWidth: 9)
            ForEach(0..<beats, id: \.self) { index in
                Circle()
                    .trim(
                        from: CGFloat(index) / CGFloat(beats) + 0.012,
                        to: CGFloat(index + 1) / CGFloat(beats) - 0.012
                    )
                    .stroke(
                        color(for: index),
                        style: StrokeStyle(lineWidth: index == currentBeat && isPlaying ? 12 : 9, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .animation(.easeOut(duration: 0.08), value: currentBeat)
            }
        }
    }

    private func color(for index: Int) -> Color {
        if index == currentBeat && isPlaying {
            return .yellow
        }
        if index == 0 {
            return .yellow.opacity(0.62)
        }
        return .cyan.opacity(0.62)
    }
}

#Preview {
    WatchMetronomeView()
        .environmentObject(WatchMetronome())
}
