-- Usage:
--   /Applications/REAPER.app/Contents/MacOS/REAPER -nonewinst scripts/reaper-install-groove-click.lua
--
-- Creates or refreshes a dedicated Groove Metronome click track in the current
-- REAPER project and saves it as a reusable track template.

local track_name = "Groove Click - Groove Metronome"
local template_name = "Groove Click - Groove Metronome.RTrackTemplate"

local function find_track_by_name(name)
  for i = 0, reaper.CountTracks(0) - 1 do
    local track = reaper.GetTrack(0, i)
    local _, current_name = reaper.GetSetMediaTrackInfo_String(track, "P_NAME", "", false)
    if current_name == name then
      return track
    end
  end
  return nil
end

local function ensure_track()
  local track = find_track_by_name(track_name)
  if track then
    return track
  end

  local insert_index = reaper.CountTracks(0)
  reaper.InsertTrackAtIndex(insert_index, true)
  track = reaper.GetTrack(0, insert_index)
  reaper.GetSetMediaTrackInfo_String(track, "P_NAME", track_name, true)
  reaper.SetMediaTrackInfo_Value(track, "D_VOL", 1.0)
  reaper.SetMediaTrackInfo_Value(track, "B_MUTE", 0)
  reaper.SetMediaTrackInfo_Value(track, "I_SOLO", 0)
  return track
end

local function has_groove_fx(track)
  for i = 0, reaper.TrackFX_GetCount(track) - 1 do
    local _, fx_name = reaper.TrackFX_GetFXName(track, i, "")
    if fx_name:find("Groove Metronome", 1, true) then
      return i
    end
  end
  return -1
end

local function add_groove_fx(track)
  local existing = has_groove_fx(track)
  if existing >= 0 then
    return existing
  end

  local candidates = {
    "AU: Groove Metronome (Nathaniel School of Music)",
    "Nathaniel School of Music: Groove Metronome",
    "AU: Nathaniel School of Music: Groove Metronome",
    "Groove Metronome"
  }

  for _, name in ipairs(candidates) do
    local fx = reaper.TrackFX_AddByName(track, name, false, 1)
    if fx >= 0 then
      return fx
    end
  end

  return -1
end

local function save_track_template(track)
  local ok, chunk = reaper.GetTrackStateChunk(track, "", false)
  if not ok or not chunk or chunk == "" then
    return false, "Could not read track state."
  end

  local template_path = reaper.GetResourcePath() .. "/TrackTemplates/" .. template_name
  local file, err = io.open(template_path, "w")
  if not file then
    return false, err or "Could not write template."
  end

  file:write(chunk)
  file:close()
  return true, template_path
end

reaper.Undo_BeginBlock()
local track = ensure_track()
reaper.SetOnlyTrackSelected(track)
local fx = add_groove_fx(track)

if fx >= 0 then
  reaper.TrackFX_SetEnabled(track, fx, true)
  reaper.TrackFX_Show(track, fx, 3)
  local saved, detail = save_track_template(track)
  reaper.UpdateArrange()
  reaper.Undo_EndBlock("Install Groove Metronome click track", -1)

  local message = "Groove Metronome track is ready."
  if saved then
    message = message .. "\nSaved track template:\n" .. detail
  else
    message = message .. "\nTrack template was not saved: " .. tostring(detail)
  end
  reaper.ShowMessageBox(message, "Groove Metronome", 0)
else
  reaper.Undo_EndBlock("Install Groove Metronome click track failed", -1)
  reaper.ShowMessageBox(
    "Could not add Groove Metronome. Confirm the AU plugin exists at ~/Library/Audio/Plug-Ins/Components/Groove Metronome.component, then rescan Audio Units in REAPER.",
    "Groove Metronome",
    0
  )
end
