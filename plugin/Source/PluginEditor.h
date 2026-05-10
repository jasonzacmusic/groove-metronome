#pragma once

#include "PluginProcessor.h"

#include <juce_gui_basics/juce_gui_basics.h>

class GrooveMetronomeAudioProcessorEditor final : public juce::AudioProcessorEditor,
                                                  private juce::Timer
{
public:
    explicit GrooveMetronomeAudioProcessorEditor(GrooveMetronomeAudioProcessor& processor);
    ~GrooveMetronomeAudioProcessorEditor() override = default;

    void paint(juce::Graphics& g) override;
    void resized() override;

private:
    using SliderAttachment = juce::AudioProcessorValueTreeState::SliderAttachment;
    using ButtonAttachment = juce::AudioProcessorValueTreeState::ButtonAttachment;
    using ComboBoxAttachment = juce::AudioProcessorValueTreeState::ComboBoxAttachment;

    class BeatWheel final : public juce::Component
    {
    public:
        explicit BeatWheel(GrooveMetronomeAudioProcessor& processorToUse);
        void paint(juce::Graphics& g) override;

    private:
        GrooveMetronomeAudioProcessor& processor;
    };

    void timerCallback() override;
    void styleSlider(juce::Slider& slider);
    void styleCombo(juce::ComboBox& combo);
    void styleButton(juce::Button& button);
    void addModeButton(juce::TextButton& button, const juce::String& title, const juce::String& subtitle);
    void drawPluginMark(juce::Graphics& g, juce::Rectangle<float> area);

    GrooveMetronomeAudioProcessor& audioProcessor;

    BeatWheel wheel;

    juce::Label titleLabel;
    juce::Label subtitleLabel;
    juce::Label bpmValueLabel;
    juce::Label tempoWordLabel;
    juce::Label outputLabel;
    juce::Label manualBpmLabel;
    juce::Label subdivisionLabel;
    juce::Label soundLabel;
    juce::Label accentLabel;
    juce::Label swingLabel;
    juce::Label printNoteLabel;

    juce::ToggleButton hostTempoButton;
    juce::Slider outputSlider;
    juce::Slider manualBpmSlider;
    juce::Slider swingSlider;
    juce::ComboBox subdivisionBox;
    juce::ComboBox soundBox;
    juce::ComboBox accentBox;

    juce::TextButton beatMapButton;
    juce::TextButton levelsButton;
    juce::TextButton polyrhythmButton;
    juce::TextButton polymeterButton;
    juce::TextButton printCurrentButton;
    juce::TextButton printNewButton;

    std::unique_ptr<ButtonAttachment> hostTempoAttachment;
    std::unique_ptr<SliderAttachment> outputAttachment;
    std::unique_ptr<SliderAttachment> manualBpmAttachment;
    std::unique_ptr<SliderAttachment> swingAttachment;
    std::unique_ptr<ComboBoxAttachment> subdivisionAttachment;
    std::unique_ptr<ComboBoxAttachment> soundAttachment;
    std::unique_ptr<ComboBoxAttachment> accentAttachment;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(GrooveMetronomeAudioProcessorEditor)
};
