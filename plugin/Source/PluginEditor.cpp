#include "PluginEditor.h"

namespace
{
const auto ink = juce::Colour(0xff251d18);
const auto paper = juce::Colour(0xffe6dbc4);
const auto paperDeep = juce::Colour(0xffd4c2a6);
const auto brass = juce::Colour(0xffbf6a24);
const auto oxblood = juce::Colour(0xff7c4b3f);
const auto mutedInk = juce::Colour(0xff746252);

juce::String tempoWord(float bpm)
{
    if (bpm < 60.0f) return "Largo";
    if (bpm < 76.0f) return "Adagio";
    if (bpm < 108.0f) return "Andante";
    if (bpm < 120.0f) return "Moderato";
    if (bpm < 156.0f) return "Allegro";
    if (bpm < 176.0f) return "Vivace";
    return "Presto";
}

void drawSection(juce::Graphics& g, juce::Rectangle<int> area, const juce::String& title)
{
    g.setColour(ink.withAlpha(0.20f));
    g.drawRoundedRectangle(area.toFloat(), 8.0f, 1.0f);
    g.setColour(ink.withAlpha(0.045f));
    g.fillRoundedRectangle(area.toFloat().reduced(1.0f), 8.0f);
    g.setColour(brass);
    g.setFont(juce::FontOptions(10.0f, juce::Font::plain));
    g.drawText(title.toUpperCase(), area.reduced(14, 10).removeFromTop(16), juce::Justification::left);
}

juce::Path makePieSlice(juce::Rectangle<float> bounds, float startRadians, float endRadians)
{
    juce::Path slice;
    const auto centre = bounds.getCentre();
    const auto radius = bounds.getWidth() * 0.5f;
    slice.startNewSubPath(centre);
    slice.lineTo(centre.x + std::cos(startRadians) * radius, centre.y + std::sin(startRadians) * radius);
    slice.addCentredArc(centre.x, centre.y, radius, radius, 0.0f, startRadians, endRadians, true);
    slice.closeSubPath();
    return slice;
}
}

GrooveMetronomeAudioProcessorEditor::BeatWheel::BeatWheel(GrooveMetronomeAudioProcessor& processorToUse)
    : processor(processorToUse)
{
}

void GrooveMetronomeAudioProcessorEditor::BeatWheel::paint(juce::Graphics& g)
{
    auto bounds = getLocalBounds().toFloat().reduced(10.0f);
    const auto size = juce::jmin(bounds.getWidth(), bounds.getHeight());
    auto wheelArea = juce::Rectangle<float>(0.0f, 0.0f, size, size).withCentre(bounds.getCentre());
    auto centre = wheelArea.getCentre();
    const auto radius = wheelArea.getWidth() * 0.47f;
    const auto innerRadius = radius * 0.48f;
    const auto bpm = processor.getFloatParameterValue("manualBpm");
    const auto subdivision = juce::jlimit(1, 4, processor.getIntParameterValue("subdivision") + 1);
    const auto accents = processor.getIntParameterValue("accentMode");

    g.setColour(ink.withAlpha(0.10f));
    g.fillEllipse(wheelArea.expanded(5.0f));
    g.setColour(ink.withAlpha(0.55f));
    g.drawEllipse(wheelArea, 1.2f);

    for (int beat = 0; beat < 4; ++beat)
    {
        const auto start = -juce::MathConstants<float>::halfPi + beat * juce::MathConstants<float>::halfPi;
        const auto end = start + juce::MathConstants<float>::halfPi;
        juce::Path segment;
        segment.addCentredArc(centre.x, centre.y, radius, radius, 0.0f, start, end, true);
        segment.addCentredArc(centre.x, centre.y, innerRadius, innerRadius, 0.0f, end, start, false);
        segment.closeSubPath();

        const auto accented = accents == 1 || (accents == 0 && beat == 0) || (accents == 2 && (beat == 1 || beat == 3));
        g.setColour(accented ? brass.withAlpha(0.75f) : oxblood.withAlpha(0.52f));
        g.fillPath(segment);
        g.setColour(ink.withAlpha(0.30f));
        g.strokePath(segment, juce::PathStrokeType(1.0f));

        for (int pulse = 1; pulse < subdivision; ++pulse)
        {
            const auto angle = start + (end - start) * static_cast<float>(pulse) / static_cast<float>(subdivision);
            juce::Path line;
            line.startNewSubPath(centre.x + std::cos(angle) * innerRadius, centre.y + std::sin(angle) * innerRadius);
            line.lineTo(centre.x + std::cos(angle) * radius, centre.y + std::sin(angle) * radius);
            g.setColour(paper.withAlpha(0.48f));
            g.strokePath(line, juce::PathStrokeType(1.0f));
        }

        const auto labelAngle = start + (end - start) * 0.5f;
        const auto labelPoint = centre + juce::Point<float>(std::cos(labelAngle), std::sin(labelAngle)) * (radius + 18.0f);
        g.setColour(ink);
        g.fillEllipse(labelPoint.x - 17.0f, labelPoint.y - 17.0f, 34.0f, 34.0f);
        g.setColour(paper);
        g.setFont(juce::FontOptions(18.0f));
        g.drawText(juce::String(beat + 1), juce::Rectangle<float>(labelPoint.x - 16.0f, labelPoint.y - 14.0f, 32.0f, 28.0f), juce::Justification::centred);
    }

    g.setGradientFill(juce::ColourGradient(paper.brighter(0.06f), centre.x, centre.y - innerRadius, paperDeep, centre.x, centre.y + innerRadius, false));
    g.fillEllipse(centre.x - innerRadius * 0.92f, centre.y - innerRadius * 0.92f, innerRadius * 1.84f, innerRadius * 1.84f);
    g.setColour(ink.withAlpha(0.18f));
    for (int ring = 0; ring < 7; ++ring)
    {
        const auto r = innerRadius * (0.88f - ring * 0.09f);
        g.drawEllipse(centre.x - r, centre.y - r, r * 2.0f, r * 2.0f, 0.7f);
    }

    g.setColour(mutedInk);
    g.setFont(juce::FontOptions(10.0f));
    g.drawText(tempoWord(bpm).toUpperCase(), juce::Rectangle<float>(centre.x - 70.0f, centre.y - 48.0f, 140.0f, 18.0f), juce::Justification::centred);
    g.setColour(ink);
    g.setFont(juce::FontOptions(56.0f));
    g.drawText(juce::String(juce::roundToInt(bpm)), juce::Rectangle<float>(centre.x - 92.0f, centre.y - 31.0f, 184.0f, 68.0f), juce::Justification::centred);
    g.setColour(mutedInk);
    g.setFont(juce::FontOptions(10.0f));
    g.drawText("DAW SYNC", juce::Rectangle<float>(centre.x - 60.0f, centre.y + 34.0f, 120.0f, 18.0f), juce::Justification::centred);
}

GrooveMetronomeAudioProcessorEditor::GrooveMetronomeAudioProcessorEditor(GrooveMetronomeAudioProcessor& processorToUse)
    : AudioProcessorEditor(&processorToUse),
      audioProcessor(processorToUse),
      wheel(processorToUse)
{
    setSize(980, 680);
    setResizable(true, true);
    setResizeLimits(760, 560, 1600, 1100);

    titleLabel.setText("Groove Metronome", juce::dontSendNotification);
    titleLabel.setColour(juce::Label::textColourId, ink);
    titleLabel.setFont(juce::FontOptions(26.0f));
    addAndMakeVisible(titleLabel);

    subtitleLabel.setText("See it. Count it. Lock it in.", juce::dontSendNotification);
    subtitleLabel.setColour(juce::Label::textColourId, mutedInk);
    subtitleLabel.setFont(juce::FontOptions(13.0f));
    addAndMakeVisible(subtitleLabel);

    bpmValueLabel.setJustificationType(juce::Justification::centredLeft);
    bpmValueLabel.setColour(juce::Label::textColourId, brass);
    bpmValueLabel.setFont(juce::FontOptions(44.0f));
    addAndMakeVisible(bpmValueLabel);

    tempoWordLabel.setColour(juce::Label::textColourId, oxblood);
    tempoWordLabel.setFont(juce::FontOptions(13.0f));
    addAndMakeVisible(tempoWordLabel);

    outputLabel.setText("Output", juce::dontSendNotification);
    manualBpmLabel.setText("Manual BPM", juce::dontSendNotification);
    subdivisionLabel.setText("Subdivision", juce::dontSendNotification);
    soundLabel.setText("Sound", juce::dontSendNotification);
    accentLabel.setText("Accents", juce::dontSendNotification);
    swingLabel.setText("Swing", juce::dontSendNotification);

    for (auto* label : { &outputLabel, &manualBpmLabel, &subdivisionLabel, &soundLabel, &accentLabel, &swingLabel })
    {
        label->setColour(juce::Label::textColourId, ink);
        label->setFont(juce::FontOptions(14.0f));
        addAndMakeVisible(*label);
    }

    hostTempoButton.setButtonText("Follow Host Tempo");
    styleButton(hostTempoButton);
    addAndMakeVisible(hostTempoButton);

    styleSlider(outputSlider);
    outputSlider.setTextValueSuffix(" dB");
    styleSlider(manualBpmSlider);
    manualBpmSlider.setTextValueSuffix(" BPM");
    styleSlider(swingSlider);
    swingSlider.setTextValueSuffix(" %");
    addAndMakeVisible(outputSlider);
    addAndMakeVisible(manualBpmSlider);
    addAndMakeVisible(swingSlider);

    styleCombo(subdivisionBox);
    styleCombo(soundBox);
    styleCombo(accentBox);
    addAndMakeVisible(subdivisionBox);
    addAndMakeVisible(soundBox);
    addAndMakeVisible(accentBox);

    addModeButton(beatMapButton, "Beat Map", "Per-beat subdivisions");
    addModeButton(levelsButton, "Levels", "Accent strength");
    addModeButton(polyrhythmButton, "Polyrhythm", "LCM grid");
    addModeButton(polymeterButton, "Polymeter", "Meter chain");
    beatMapButton.setToggleState(true, juce::dontSendNotification);

    printCurrentButton.setButtonText("Print current track");
    printNewButton.setButtonText("Print new track");
    styleButton(printCurrentButton);
    styleButton(printNewButton);
    printCurrentButton.setTooltip("Host-safe placeholder: use DAW render/freeze for now; companion scripts will handle true one-click printing per DAW.");
    printNewButton.setTooltip("Host-safe placeholder: DAWs do not allow every plugin to create tracks directly.");
    addAndMakeVisible(printCurrentButton);
    addAndMakeVisible(printNewButton);

    printNoteLabel.setText("Print buttons are reserved for the DAW companion workflow. Today the plugin outputs sample-accurate audio for render, freeze, or bounce.", juce::dontSendNotification);
    printNoteLabel.setColour(juce::Label::textColourId, mutedInk);
    printNoteLabel.setFont(juce::FontOptions(12.0f));
    printNoteLabel.setJustificationType(juce::Justification::centredLeft);
    addAndMakeVisible(printNoteLabel);

    addAndMakeVisible(wheel);

    auto& params = audioProcessor.parameters;
    hostTempoAttachment = std::make_unique<ButtonAttachment>(params, "hostTempo", hostTempoButton);
    outputAttachment = std::make_unique<SliderAttachment>(params, "gain", outputSlider);
    manualBpmAttachment = std::make_unique<SliderAttachment>(params, "manualBpm", manualBpmSlider);
    swingAttachment = std::make_unique<SliderAttachment>(params, "swing", swingSlider);
    subdivisionAttachment = std::make_unique<ComboBoxAttachment>(params, "subdivision", subdivisionBox);
    soundAttachment = std::make_unique<ComboBoxAttachment>(params, "sound", soundBox);
    accentAttachment = std::make_unique<ComboBoxAttachment>(params, "accentMode", accentBox);

    startTimerHz(20);
}

void GrooveMetronomeAudioProcessorEditor::styleSlider(juce::Slider& slider)
{
    slider.setSliderStyle(juce::Slider::LinearHorizontal);
    slider.setTextBoxStyle(juce::Slider::TextBoxRight, false, 92, 30);
    slider.setColour(juce::Slider::trackColourId, brass);
    slider.setColour(juce::Slider::thumbColourId, brass);
    slider.setColour(juce::Slider::backgroundColourId, ink.withAlpha(0.16f));
    slider.setColour(juce::Slider::textBoxTextColourId, ink);
    slider.setColour(juce::Slider::textBoxOutlineColourId, ink.withAlpha(0.28f));
    slider.setColour(juce::Slider::textBoxBackgroundColourId, paper.withAlpha(0.70f));
}

void GrooveMetronomeAudioProcessorEditor::styleCombo(juce::ComboBox& combo)
{
    combo.setColour(juce::ComboBox::backgroundColourId, paper.withAlpha(0.66f));
    combo.setColour(juce::ComboBox::outlineColourId, ink.withAlpha(0.36f));
    combo.setColour(juce::ComboBox::textColourId, ink);
    combo.setColour(juce::ComboBox::arrowColourId, brass);
}

void GrooveMetronomeAudioProcessorEditor::styleButton(juce::Button& button)
{
    button.setColour(juce::TextButton::buttonColourId, paper.withAlpha(0.58f));
    button.setColour(juce::TextButton::buttonOnColourId, brass.withAlpha(0.88f));
    button.setColour(juce::TextButton::textColourOffId, ink);
    button.setColour(juce::TextButton::textColourOnId, juce::Colours::white);
}

void GrooveMetronomeAudioProcessorEditor::addModeButton(juce::TextButton& button, const juce::String& title, const juce::String& subtitle)
{
    button.setButtonText(title + "\n" + subtitle);
    button.setClickingTogglesState(true);
    styleButton(button);
    addAndMakeVisible(button);
}

void GrooveMetronomeAudioProcessorEditor::timerCallback()
{
    const auto bpm = audioProcessor.getFloatParameterValue("manualBpm");
    bpmValueLabel.setText(juce::String(juce::roundToInt(bpm)), juce::dontSendNotification);
    tempoWordLabel.setText(tempoWord(bpm), juce::dontSendNotification);
    wheel.repaint();
}

void GrooveMetronomeAudioProcessorEditor::paint(juce::Graphics& g)
{
    auto area = getLocalBounds();
    g.fillAll(paper);

    g.setColour(ink.withAlpha(0.035f));
    for (int x = 0; x < getWidth(); x += 96)
        g.drawVerticalLine(x, 0.0f, static_cast<float>(getHeight()));

    g.setGradientFill(juce::ColourGradient(brass.withAlpha(0.18f), 0.0f, 0.0f, paper.withAlpha(0.0f), static_cast<float>(getWidth()), static_cast<float>(getHeight()), false));
    g.fillRect(area);

    g.setColour(ink.withAlpha(0.18f));
    g.drawLine(0.0f, 82.0f, static_cast<float>(getWidth()), 82.0f, 1.0f);
    drawPluginMark(g, juce::Rectangle<float>(26.0f, 22.0f, 44.0f, 44.0f));

    auto content = getLocalBounds().reduced(24);
    content.removeFromTop(90);
    auto left = content.removeFromLeft(juce::jmax(420, content.getWidth() / 2));
    auto right = content;
    drawSection(g, left.reduced(0, 0), "Metronome");
    drawSection(g, right.reduced(14, 0), "Controls");
}

void GrooveMetronomeAudioProcessorEditor::drawPluginMark(juce::Graphics& g, juce::Rectangle<float> area)
{
    g.setColour(ink);
    g.fillRoundedRectangle(area, 10.0f);
    auto wheelBounds = area.reduced(7.0f);
    g.setColour(paper);
    g.fillEllipse(wheelBounds);
    g.setColour(brass);
    g.fillPath(makePieSlice(wheelBounds, -0.35f, 1.55f));
    g.setColour(oxblood);
    g.fillPath(makePieSlice(wheelBounds, 1.55f, 3.9f));
    g.setColour(ink);
    g.drawLine(area.getCentreX(), area.getY() + 11.0f, area.getRight() - 10.0f, area.getCentreY() + 3.0f, 3.0f);
    g.setColour(juce::Colour(0xff48e48a));
    g.fillEllipse(area.getRight() - 13.5f, area.getCentreY() - 2.5f, 7.0f, 7.0f);
}

void GrooveMetronomeAudioProcessorEditor::resized()
{
    auto area = getLocalBounds().reduced(24);
    auto header = area.removeFromTop(72);
    auto titleArea = header.withTrimmedLeft(58).withTrimmedTop(6);
    titleLabel.setBounds(titleArea.removeFromTop(34));
    subtitleLabel.setBounds(titleArea.removeFromTop(22));

    area.removeFromTop(18);
    auto left = area.removeFromLeft(juce::jmax(420, area.getWidth() / 2)).reduced(18);
    auto right = area.reduced(30, 18);

    auto tempoStrip = left.removeFromTop(86);
    bpmValueLabel.setBounds(tempoStrip.removeFromLeft(110));
    tempoWordLabel.setBounds(tempoStrip.removeFromLeft(130).withTrimmedTop(23));
    hostTempoButton.setBounds(tempoStrip.removeFromRight(190).withSizeKeepingCentre(180, 34));
    left.removeFromTop(12);
    wheel.setBounds(left.reduced(8));

    auto modes = right.removeFromTop(180);
    auto modeRowHeight = 38;
    beatMapButton.setBounds(modes.removeFromTop(modeRowHeight));
    modes.removeFromTop(8);
    levelsButton.setBounds(modes.removeFromTop(modeRowHeight));
    modes.removeFromTop(8);
    polyrhythmButton.setBounds(modes.removeFromTop(modeRowHeight));
    modes.removeFromTop(8);
    polymeterButton.setBounds(modes.removeFromTop(modeRowHeight));
    right.removeFromTop(20);

    auto row = [&right](juce::Label& label, juce::Component& control)
    {
        auto bounds = right.removeFromTop(44);
        label.setBounds(bounds.removeFromLeft(112));
        control.setBounds(bounds);
        right.removeFromTop(10);
    };

    row(outputLabel, outputSlider);
    row(manualBpmLabel, manualBpmSlider);
    row(subdivisionLabel, subdivisionBox);
    row(soundLabel, soundBox);
    row(accentLabel, accentBox);
    row(swingLabel, swingSlider);

    right.removeFromTop(6);
    auto printArea = right.removeFromTop(78);
    printCurrentButton.setBounds(printArea.removeFromLeft(printArea.getWidth() / 2).reduced(0, 14));
    printArea.removeFromLeft(8);
    printNewButton.setBounds(printArea.reduced(0, 14));
    printNoteLabel.setBounds(right.removeFromTop(44));
}
