# AppleScript Fallback for macOS

This PR adds a fallback solution for macOS users experiencing crashes with the `n-nowplaying` native module due to Node.js version compatibility issues.

## Problem
The native `n-nowplaying` module occasionally fails to load on macOS systems, particularly when there are Node.js version mismatches or missing native dependencies. This results in the Local Audio app crashing and failing to provide music metadata from Apple Music.

## Solution
This PR implements an AppleScript-based fallback that automatically activates when the native module fails on macOS systems.

### Features
- **Automatic fallback**: Seamlessly switches to AppleScript when native module fails
- **Full playback control**: Play, pause, next, previous, seek, volume, and shuffle
- **Real-time metadata**: Polls Apple Music every 2 seconds for current track information
- **macOS-specific**: Only activates on macOS (darwin) platform when needed
- **No breaking changes**: Maintains full compatibility with existing functionality

### Files Added/Modified
- `server/applemusic-fallback.cjs`: New AppleScript-based nowplaying implementation
- `server/nowplayingWrapper.ts`: Modified to include fallback logic for macOS

### Implementation Details
The fallback uses macOS's built-in `osascript` command to:
- Query Apple Music for current track metadata
- Control playback (play, pause, next, previous, seek)
- Adjust volume and shuffle settings
- Detect when Apple Music is not running or stopped

### Usage
No configuration required - the fallback activates automatically when:
1. Platform is macOS (`darwin`)
2. Native `n-nowplaying` module fails to load
3. AppleScript fallback successfully loads

## Testing
Tested on macOS with:
- Apple Music playback and controls
- Metadata display in DeskThing vinylplayer app
- Various playback states (playing, paused, stopped)
- App switching and Apple Music restart scenarios

This solution provides a reliable alternative for macOS users while maintaining the performance benefits of the native module when it works correctly.
