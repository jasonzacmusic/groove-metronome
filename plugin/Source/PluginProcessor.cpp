#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "BinaryData.h"

#include <juce_audio_formats/juce_audio_formats.h>

#include <cmath>

namespace
{
constexpr auto* gainId = "gain";
constexpr auto* hostTempoId = "hostTempo";
constexpr auto* manualBpmId = "manualBpm";
constexpr auto* subdivisionId = "subdivision";
constexpr auto* soundId = "sound";
constexpr auto* accentModeId = "accentMode";
constexpr auto* swingId = "swing";

juce::StringArray soundChoices()
{
    return { "Marimba", "Wood", "Clave", "Tabla", "Shaker", "Tight" };
}

juce::StringArray accentChoices()
{
    return { "Downbeat", "All Beats", "Backbeat 2 & 4", "No Accents" };
}

double beatLengthPpq(int denominator)
{
    return 4.0 / juce::jlimit(1, 32, denominator);
}

double wrapBarPpq(double ppq, double barLength)
{
    if (barLength <= 0.0)
        return 0.0;

    auto wrapped = std::fmod(ppq, barLength);
    if (wrapped < 0.0)
        wrapped += barLength;
    return wrapped;
}
}

GrooveMetronomeAudioProcessor::GrooveMetronomeAudioProcessor()
    : AudioProcessor(BusesProperties()
          .withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      parameters(*this, nullptr, "PARAMETERS", createParameterLayout())
{
    loadEmbeddedSamples();
}

juce::AudioProcessorValueTreeState::ParameterLayout GrooveMetronomeAudioProcessor::createParameterLayout()
{
    std::vector<std::unique_ptr<juce::RangedAudioParameter>> params;

    params.push_back(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID(gainId, 1), "Output", juce::NormalisableRange<float>(-36.0f, 0.0f, 0.1f), -8.0f, "dB"));

    params.push_back(std::make_unique<juce::AudioParameterBool>(
        juce::ParameterID(hostTempoId, 1), "Follow Host Tempo", true));

    params.push_back(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID(manualBpmId, 1), "Manual BPM", juce::NormalisableRange<float>(20.0f, 300.0f, 1.0f), 100.0f, "BPM"));

    params.push_back(std::make_unique<juce::AudioParameterChoice>(
        juce::ParameterID(subdivisionId, 1), "Subdivision", juce::StringArray { "Quarter", "Eighths", "Triplets", "Sixteenths" }, 0));

    params.push_back(std::make_unique<juce::AudioParameterChoice>(
        juce::ParameterID(soundId, 1), "Sound", soundChoices(), 0));

    params.push_back(std::make_unique<juce::AudioParameterChoice>(
        juce::ParameterID(accentModeId, 1), "Accents", accentChoices(), 0));

    params.push_back(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID(swingId, 1), "Swing", juce::NormalisableRange<float>(0.0f, 70.0f, 1.0f), 0.0f, "%"));

    return { params.begin(), params.end() };
}

void GrooveMetronomeAudioProcessor::prepareToPlay(double sampleRate, int samplesPerBlock)
{
    juce::ignoreUnused(samplesPerBlock);
    currentSampleRate = sampleRate > 0.0 ? sampleRate : 44100.0;
    lastStep = -1.0;
    lastPpq = 0.0;
    for (auto& voice : voices)
        voice = {};
}

void GrooveMetronomeAudioProcessor::releaseResources()
{
    for (auto& voice : voices)
        voice = {};
}

void GrooveMetronomeAudioProcessor::loadEmbeddedSamples()
{
    loadEmbeddedSample(sampleFamilies[static_cast<int>(SoundFamily::marimba)].accent, BinaryData::marimbaaccent_wav, BinaryData::marimbaaccent_wavSize);
    loadEmbeddedSample(sampleFamilies[static_cast<int>(SoundFamily::marimba)].normal, BinaryData::marimbanormal_wav, BinaryData::marimbanormal_wavSize);
    loadEmbeddedSample(sampleFamilies[static_cast<int>(SoundFamily::marimba)].sub, BinaryData::marimbasub_wav, BinaryData::marimbasub_wavSize);

    loadEmbeddedSample(sampleFamilies[static_cast<int>(SoundFamily::wood)].accent, BinaryData::rimaccent_wav, BinaryData::rimaccent_wavSize);
    loadEmbeddedSample(sampleFamilies[static_cast<int>(SoundFamily::wood)].normal, BinaryData::rimnormal_wav, BinaryData::rimnormal_wavSize);
    loadEmbeddedSample(sampleFamilies[static_cast<int>(SoundFamily::wood)].sub, BinaryData::rimsub_wav, BinaryData::rimsub_wavSize);

    loadEmbeddedSample(sampleFamilies[static_cast<int>(SoundFamily::clave)].accent, BinaryData::claveaccent_wav, BinaryData::claveaccent_wavSize);
    loadEmbeddedSample(sampleFamilies[static_cast<int>(SoundFamily::clave)].normal, BinaryData::clavenormal_wav, BinaryData::clavenormal_wavSize);
    loadEmbeddedSample(sampleFamilies[static_cast<int>(SoundFamily::clave)].sub, BinaryData::clavesub_wav, BinaryData::clavesub_wavSize);

    loadEmbeddedSample(sampleFamilies[static_cast<int>(SoundFamily::tabla)].accent, BinaryData::tablaaccent_wav, BinaryData::tablaaccent_wavSize);
    loadEmbeddedSample(sampleFamilies[static_cast<int>(SoundFamily::tabla)].normal, BinaryData::tablanormal_wav, BinaryData::tablanormal_wavSize);
    loadEmbeddedSample(sampleFamilies[static_cast<int>(SoundFamily::tabla)].sub, BinaryData::tablasub_wav, BinaryData::tablasub_wavSize);

    loadEmbeddedSample(sampleFamilies[static_cast<int>(SoundFamily::shaker)].accent, BinaryData::shakeraccent_wav, BinaryData::shakeraccent_wavSize);
    loadEmbeddedSample(sampleFamilies[static_cast<int>(SoundFamily::shaker)].normal, BinaryData::shakernormal_wav, BinaryData::shakernormal_wavSize);
    loadEmbeddedSample(sampleFamilies[static_cast<int>(SoundFamily::shaker)].sub, BinaryData::shakersub_wav, BinaryData::shakersub_wavSize);

    loadEmbeddedSample(sampleFamilies[static_cast<int>(SoundFamily::tight)].accent, BinaryData::tightaccent_wav, BinaryData::tightaccent_wavSize);
    loadEmbeddedSample(sampleFamilies[static_cast<int>(SoundFamily::tight)].normal, BinaryData::tightnormal_wav, BinaryData::tightnormal_wavSize);
    loadEmbeddedSample(sampleFamilies[static_cast<int>(SoundFamily::tight)].sub, BinaryData::tightsub_wav, BinaryData::tightsub_wavSize);
}

void GrooveMetronomeAudioProcessor::loadEmbeddedSample(SampleSlot& slot, const void* data, int dataSize)
{
    slot = {};

    if (data == nullptr || dataSize <= 0)
        return;

    juce::MemoryInputStream stream(data, static_cast<size_t>(dataSize), false);
    juce::WavAudioFormat wavFormat;
    std::unique_ptr<juce::AudioFormatReader> reader(wavFormat.createReaderFor(&stream, false));
    if (reader == nullptr || reader->lengthInSamples <= 0)
        return;

    const auto frames = static_cast<int>(juce::jmin<juce::int64>(reader->lengthInSamples, 44100));
    juce::AudioBuffer<float> temp(static_cast<int>(reader->numChannels), frames);
    reader->read(&temp, 0, frames, 0, true, true);

    slot.data.resize(static_cast<size_t>(frames), 0.0f);
    auto peak = 0.0f;
    for (int sample = 0; sample < frames; ++sample)
    {
        auto value = 0.0f;
        for (int channel = 0; channel < temp.getNumChannels(); ++channel)
            value += temp.getSample(channel, sample);

        value /= static_cast<float>(juce::jmax(1, temp.getNumChannels()));
        slot.data[static_cast<size_t>(sample)] = value;
        peak = juce::jmax(peak, std::abs(value));
    }

    if (peak > 0.0001f)
    {
        const auto normalise = 0.82f / peak;
        for (auto& sample : slot.data)
            sample *= normalise;
    }

    slot.sourceRate = reader->sampleRate > 0.0 ? reader->sampleRate : 44100.0;
}

const GrooveMetronomeAudioProcessor::SampleSlot* GrooveMetronomeAudioProcessor::selectSample(SoundFamily sound, bool accented, bool beatPulse) const
{
    const auto familyIndex = juce::jlimit(0, static_cast<int>(sampleFamilies.size()) - 1, static_cast<int>(sound));
    const auto& family = sampleFamilies[static_cast<size_t>(familyIndex)];
    const auto& slot = accented ? family.accent : beatPulse ? family.normal : family.sub;
    return slot.data.empty() ? nullptr : &slot;
}

bool GrooveMetronomeAudioProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const
{
    const auto& output = layouts.getMainOutputChannelSet();
    return output == juce::AudioChannelSet::mono() || output == juce::AudioChannelSet::stereo();
}

void GrooveMetronomeAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{
    juce::ignoreUnused(midiMessages);
    juce::ScopedNoDenormals noDenormals;

    buffer.clear();

    const auto sampleCount = buffer.getNumSamples();
    if (sampleCount <= 0)
        return;

    auto position = getPlayHead() != nullptr ? getPlayHead()->getPosition() : std::optional<juce::AudioPlayHead::PositionInfo> {};
    const auto isPlaying = position && position->getIsPlaying();
    const auto bpm = getBoolParam(hostTempoId) && position && position->getBpm().hasValue()
        ? *position->getBpm()
        : static_cast<double>(getFloatParam(manualBpmId));

    auto numerator = 4;
    auto denominator = 4;
    if (position && position->getTimeSignature().hasValue())
    {
        numerator = juce::jlimit(1, 32, position->getTimeSignature()->numerator);
        denominator = juce::jlimit(1, 32, position->getTimeSignature()->denominator);
    }

    const auto beatPpq = beatLengthPpq(denominator);
    const auto barLength = beatPpq * static_cast<double>(numerator);
    const auto subdivision = getIntParam(subdivisionId) + 1;
    const auto stepPpq = beatPpq / static_cast<double>(subdivision);
    const auto ppqPerSample = (bpm / 60.0) / currentSampleRate;
    const auto stepSamples = ppqPerSample > 0.0 ? stepPpq / ppqPerSample : 0.0;
    auto startPpq = position && position->getPpqPosition().hasValue() ? *position->getPpqPosition() : lastPpq;
    const auto jumpedBackwards = startPpq + 0.000001 < lastPpq;

    if (!isPlaying || jumpedBackwards)
    {
        lastStep = -1.0;
        lastPpq = startPpq;
    }

    const auto outputGain = juce::Decibels::decibelsToGain(getFloatParam(gainId));

    for (int sample = 0; sample < sampleCount; ++sample)
    {
        if (isPlaying && stepPpq > 0.0)
        {
            const auto ppq = startPpq + ppqPerSample * static_cast<double>(sample);
            const auto barPpq = wrapBarPpq(ppq, barLength);
            const auto step = static_cast<int>(std::floor(barPpq / stepPpq + 0.000001));

            if (step != lastStep)
            {
                const auto beatIndex = static_cast<int>(std::floor(barPpq / beatPpq + 0.000001));
                const auto pulseIndex = static_cast<int>(std::fmod(step, static_cast<double>(subdivision)));
                const auto swingAmount = getFloatParam(swingId) / 100.0f;
                const auto swingableOffbeat = (subdivision == 2 || subdivision == 4) && (pulseIndex % 2 == 1);
                const auto swingDelaySamples = swingableOffbeat
                    ? static_cast<int>(juce::roundToInt(stepSamples * static_cast<double>(swingAmount) * 0.32))
                    : 0;
                triggerClick(beatIndex, pulseIndex, bpm, numerator, swingDelaySamples);
                lastStep = step;
            }
        }

        auto value = 0.0f;
        for (auto& voice : voices)
            value += renderVoice(voice);

        value = juce::jlimit(-1.0f, 1.0f, value * outputGain);
        for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
            buffer.setSample(channel, sample, value);
    }

    lastPpq = startPpq + ppqPerSample * static_cast<double>(sampleCount);
}

void GrooveMetronomeAudioProcessor::triggerClick(int beatIndex, int pulseIndex, double bpm, int numerator, int delaySamples)
{
    const auto accentMode = static_cast<AccentMode>(getIntParam(accentModeId));
    const auto sound = static_cast<SoundFamily>(getIntParam(soundId));
    const auto downbeat = beatIndex == 0 && pulseIndex == 0;
    const auto beatPulse = pulseIndex == 0;
    const auto backbeat = beatPulse && numerator >= 4 && (beatIndex == 1 || beatIndex == 3);

    auto accented = false;
    if (accentMode == AccentMode::downbeat)
        accented = downbeat;
    else if (accentMode == AccentMode::all)
        accented = beatPulse;
    else if (accentMode == AccentMode::backbeat)
        accented = backbeat;

    const auto pulseGain = beatPulse ? (accented ? 1.0 : 0.68) : 0.34;
    const auto bpmTrim = bpm > 180.0 && !beatPulse ? 0.7 : 1.0;

    auto* selected = &voices[0];
    for (auto& voice : voices)
    {
        if (!voice.active)
        {
            selected = &voice;
            break;
        }
    }

    selected->active = true;
    selected->sound = sound;
    selected->sample = selectSample(sound, accented, beatPulse);
    selected->samplePosition = 0.0;
    selected->sampleRateRatio = selected->sample != nullptr ? selected->sample->sourceRate / currentSampleRate : 1.0;
    selected->sampleGain = static_cast<float>(pulseGain * bpmTrim);
    selected->phase = 0.0;
    selected->envelope = pulseGain * bpmTrim;
    selected->noise = 0.0;
    selected->delaySamples = juce::jmax(0, delaySamples);

    switch (sound)
    {
        case SoundFamily::marimba:
            selected->frequency = accented ? 880.0 : beatPulse ? 660.0 : 440.0;
            selected->decay = accented ? 0.9962 : 0.9952;
            selected->samplesLeft = static_cast<int>(currentSampleRate * 0.22);
            break;
        case SoundFamily::wood:
            selected->frequency = accented ? 760.0 : beatPulse ? 560.0 : 420.0;
            selected->decay = 0.992;
            selected->samplesLeft = static_cast<int>(currentSampleRate * 0.12);
            break;
        case SoundFamily::clave:
            selected->frequency = accented ? 1700.0 : beatPulse ? 1280.0 : 940.0;
            selected->decay = 0.989;
            selected->samplesLeft = static_cast<int>(currentSampleRate * 0.08);
            break;
        case SoundFamily::tabla:
            selected->frequency = accented ? 360.0 : beatPulse ? 250.0 : 190.0;
            selected->decay = 0.996;
            selected->samplesLeft = static_cast<int>(currentSampleRate * 0.18);
            break;
        case SoundFamily::shaker:
            selected->frequency = accented ? 5200.0 : beatPulse ? 3800.0 : 2600.0;
            selected->decay = 0.986;
            selected->noise = 1.0;
            selected->samplesLeft = static_cast<int>(currentSampleRate * 0.065);
            break;
        case SoundFamily::tight:
            selected->frequency = accented ? 1100.0 : beatPulse ? 820.0 : 610.0;
            selected->decay = 0.988;
            selected->samplesLeft = static_cast<int>(currentSampleRate * 0.055);
            break;
    }
}

float GrooveMetronomeAudioProcessor::renderVoice(ClickVoice& voice)
{
    if (!voice.active || voice.samplesLeft <= 0 || voice.envelope < 0.0001)
    {
        voice.active = false;
        return 0.0f;
    }

    if (voice.delaySamples > 0)
    {
        --voice.delaySamples;
        return 0.0f;
    }

    if (voice.sample != nullptr && !voice.sample->data.empty())
    {
        const auto index = static_cast<int>(voice.samplePosition);
        if (index >= static_cast<int>(voice.sample->data.size()) - 1)
        {
            voice.active = false;
            return 0.0f;
        }

        const auto fraction = static_cast<float>(voice.samplePosition - static_cast<double>(index));
        const auto a = voice.sample->data[static_cast<size_t>(index)];
        const auto b = voice.sample->data[static_cast<size_t>(index + 1)];
        voice.samplePosition += voice.sampleRateRatio;
        --voice.samplesLeft;
        return (a + (b - a) * fraction) * voice.sampleGain;
    }

    const auto phaseInc = juce::MathConstants<double>::twoPi * voice.frequency / currentSampleRate;
    voice.phase += phaseInc;
    if (voice.phase > juce::MathConstants<double>::twoPi)
        voice.phase -= juce::MathConstants<double>::twoPi;

    auto tonal = std::sin(voice.phase);
    if (voice.sound == SoundFamily::wood || voice.sound == SoundFamily::clave || voice.sound == SoundFamily::tight)
        tonal = tonal >= 0.0 ? 1.0 : -1.0;

    const auto noise = voice.noise > 0.0 ? nextNoise() * voice.noise : 0.0f;
    const auto sample = static_cast<float>((tonal * (1.0 - voice.noise * 0.72) + noise * 0.72) * voice.envelope * 0.55);

    voice.envelope *= voice.decay;
    --voice.samplesLeft;
    return sample;
}

float GrooveMetronomeAudioProcessor::nextNoise()
{
    noiseState = noiseState * 1664525u + 1013904223u;
    return static_cast<float>((static_cast<int32_t>(noiseState >> 8) / 8388608.0f) - 1.0f);
}

int GrooveMetronomeAudioProcessor::getIntParam(const juce::String& id) const
{
    return static_cast<int>(*parameters.getRawParameterValue(id));
}

float GrooveMetronomeAudioProcessor::getFloatParam(const juce::String& id) const
{
    return *parameters.getRawParameterValue(id);
}

bool GrooveMetronomeAudioProcessor::getBoolParam(const juce::String& id) const
{
    return *parameters.getRawParameterValue(id) > 0.5f;
}

juce::AudioProcessorEditor* GrooveMetronomeAudioProcessor::createEditor()
{
    return new GrooveMetronomeAudioProcessorEditor(*this);
}

void GrooveMetronomeAudioProcessor::getStateInformation(juce::MemoryBlock& destData)
{
    auto state = parameters.copyState();
    std::unique_ptr<juce::XmlElement> xml(state.createXml());
    copyXmlToBinary(*xml, destData);
}

void GrooveMetronomeAudioProcessor::setStateInformation(const void* data, int sizeInBytes)
{
    std::unique_ptr<juce::XmlElement> xmlState(getXmlFromBinary(data, sizeInBytes));
    if (xmlState != nullptr && xmlState->hasTagName(parameters.state.getType()))
        parameters.replaceState(juce::ValueTree::fromXml(*xmlState));
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new GrooveMetronomeAudioProcessor();
}
