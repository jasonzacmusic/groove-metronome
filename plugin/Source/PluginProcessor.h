#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

#include <array>
#include <cstdint>
#include <vector>

class GrooveMetronomeAudioProcessor final : public juce::AudioProcessor
{
public:
    GrooveMetronomeAudioProcessor();
    ~GrooveMetronomeAudioProcessor() override = default;

    void prepareToPlay(double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;
    bool isBusesLayoutSupported(const BusesLayout& layouts) const override;
    void processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return JucePlugin_Name; }
    bool acceptsMidi() const override { return false; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 0.25; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram(int index) override { juce::ignoreUnused(index); }
    const juce::String getProgramName(int index) override { juce::ignoreUnused(index); return {}; }
    void changeProgramName(int index, const juce::String& newName) override { juce::ignoreUnused(index, newName); }

    void getStateInformation(juce::MemoryBlock& destData) override;
    void setStateInformation(const void* data, int sizeInBytes) override;

    juce::AudioProcessorValueTreeState parameters;

    float getFloatParameterValue(const juce::String& id) const { return getFloatParam(id); }
    int getIntParameterValue(const juce::String& id) const { return getIntParam(id); }
    bool getBoolParameterValue(const juce::String& id) const { return getBoolParam(id); }

private:
    enum class SoundFamily
    {
        marimba = 0,
        wood,
        clave,
        tabla,
        shaker,
        tight
    };

    enum class AccentMode
    {
        downbeat = 0,
        all,
        backbeat,
        none
    };

    struct SampleSlot
    {
        std::vector<float> data;
        double sourceRate = 44100.0;
    };

    struct SampleFamily
    {
        SampleSlot accent;
        SampleSlot normal;
        SampleSlot sub;
    };

    struct ClickVoice
    {
        bool active = false;
        SoundFamily sound = SoundFamily::marimba;
        const SampleSlot* sample = nullptr;
        double samplePosition = 0.0;
        double sampleRateRatio = 1.0;
        float sampleGain = 1.0f;
        double phase = 0.0;
        double frequency = 660.0;
        double envelope = 0.0;
        double decay = 0.995;
        double noise = 0.0;
        int delaySamples = 0;
        int samplesLeft = 0;
    };

    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

    void loadEmbeddedSamples();
    void loadEmbeddedSample(SampleSlot& slot, const void* data, int dataSize);
    const SampleSlot* selectSample(SoundFamily sound, bool accented, bool beatPulse) const;
    void triggerClick(int beatIndex, int pulseIndex, double bpm, int numerator, int delaySamples);
    float renderVoice(ClickVoice& voice);
    float nextNoise();
    int getIntParam(const juce::String& id) const;
    float getFloatParam(const juce::String& id) const;
    bool getBoolParam(const juce::String& id) const;

    std::array<ClickVoice, 8> voices {};
    std::array<SampleFamily, 6> sampleFamilies {};
    double currentSampleRate = 44100.0;
    int lastStep = -1;
    double lastPpq = 0.0;
    uint32_t noiseState = 0x12345678;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(GrooveMetronomeAudioProcessor)
};
