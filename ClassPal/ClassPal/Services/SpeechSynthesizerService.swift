import Foundation
import AVFoundation
import SwiftUI

/// Feature 3: Core Concepts Text-to-Speech Audio Player Engine (AVFoundation)
@MainActor
public final class SpeechSynthesizerService: NSObject, ObservableObject, AVSpeechSynthesizerDelegate {
    public static let shared = SpeechSynthesizerService()

    private let synthesizer = AVSpeechSynthesizer()
    @Published public var isSpeaking: Bool = false
    @Published public var currentText: String = ""

    override private init() {
        super.init()
        synthesizer.delegate = self
    }

    public func speak(_ text: String) {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }

        if isSpeaking {
            stop()
        }

        currentText = text
        let utterance = AVSpeechUtterance(string: text)
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate
        utterance.pitchMultiplier = 1.0
        utterance.volume = 1.0

        if let voice = AVSpeechSynthesisVoice(language: "en-US") {
            utterance.voice = voice
        }

        #if os(iOS)
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, options: .duckOthers)
        try? AVAudioSession.sharedInstance().setActive(true)
        #endif

        isSpeaking = true
        synthesizer.speak(utterance)
    }

    public func stop() {
        synthesizer.stopSpeaking(at: .immediate)
        isSpeaking = false
    }

    nonisolated public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in
            self.isSpeaking = false
        }
    }

    nonisolated public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor in
            self.isSpeaking = false
        }
    }
}
