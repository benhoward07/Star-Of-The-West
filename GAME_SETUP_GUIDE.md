# Star of the West Learning Game - Setup Guide

## 🎮 Game Overview

An interactive AR learning experience about the Star of the West Monument at The Citadel. Players scan QR codes at physical locations, answer questions, earn medals, and progress through military ranks.

## 📋 Current Features

### ✅ Implemented
- **Title Screen** - Welcome screen with instructions
- **Topic Selection UI** - Interactive cards for each learning topic
- **Game State Management** - Tracks score, medals, and rank progression
- **Audio Playback** - Plays narration when topics are selected
- **Quiz System** - Multiple choice questions after each topic
- **Answer Validation** - Instant feedback on correct/incorrect answers
- **Bonus Points** - Extra points awarded for correct quiz answers
- **Medal System** - Awards digital medals for completing topics
- **Rank Progression** - 7 ranks from Recruit to Colonel
- **Conclusion Screen** - Shows final results and allows replay
- **Responsive UI** - Works on mobile and desktop

### 🎯 Game Flow
1. **Title Screen** → Player sees welcome and instructions
2. **Topic Selection** → Player chooses topics to learn about
3. **Audio Playback** → Narration plays for selected topic
4. **Quiz Questions** → Player answers multiple choice questions
5. **Answer Feedback** → Instant feedback on each answer
6. **Medal Award** → Player earns medal and points
7. **Rank Up** → Rank increases based on performance
8. **Conclusion** → Final results and replay option

## 🛠️ Next Steps to Complete Your Game

### 1. Add Audio Files
Place your audio narration files in the `/audio` folder:
- `topic1.mp3` - About the Star of the West Ship
- `topic2.mp3` - About the First Shot
- `topic3.mp3` - About the Monument History

**Recording Tips:**
- Keep narrations 30-60 seconds
- Use clear, professional voice
- Export as MP3 (128kbps or higher)
- Normalize audio levels

### 2. Add Location Images
Place photos in the `/images` folder:
- Background images for each location
- Photos of monuments/landmarks
- The Citadel campus photos

Then update `/src/components/TopicSelectionUI.ts`:
```typescript
new TopicSelectionUI(sceneInstance.contextManager, {
    locationImage: './images/summerall-field.jpg'
});
```

### 3. Customize Topics and Quiz Questions
Edit `/src/GameState.ts` to add your specific topics with quiz questions:

```typescript
public topics = new Observable<TopicData[]>([
    {
        id: 'topic1',
        title: 'Your Topic Title',
        description: 'Your topic description',
        audioFile: 'audio/your-audio.mp3',
        difficulty: 1, // 1-5 scale
        medalId: 'medal1',
        completed: false,
        quizQuestions: [
            {
                id: 'q1',
                question: 'Your question text?',
                options: [
                    'Option A',
                    'Option B',
                    'Option C',
                    'Option D'
                ],
                correctAnswer: 0 // Index of correct answer (0-3)
            }
            // Add more questions...
        ]
    },
    // Add more topics...
]);
```

### 4. Customize Medals
Edit the medals array in `/src/GameState.ts`:

```typescript
public medals = new Observable<MedalData[]>([
    {
        id: 'medal1',
        name: 'Your Medal Name',
        description: 'How to earn this medal',
        earned: false
    },
    // Add more medals...
]);
```

### 5. Set Up QR Codes (Coming Next)
You'll need to:
- Generate QR codes for each location
- Print and place them at physical locations
- Configure the app to detect QR codes
- Trigger specific topics based on QR code scanned

### 6. Adjust Rank Progression
Edit the `updateRank()` function in `/src/GameState.ts` to customize:
- Points required for each rank
- Number of medals needed
- Rank names (currently: Recruit → Cadet → Corporal → Sergeant → Lieutenant → Captain → Colonel)

### 7. Customize Visual Theme
Edit colors in any component file:
- **Primary Color**: `#6ae5e0` (cyan)
- **Secondary Color**: `#6be5ad` (green)
- **Accent Color**: `#ffd700` (gold)
- **Background**: `#1a1a2e` (dark blue)

## 📱 Testing Your Game

1. **Save all files** in Mattercraft
2. Open the **Simulator** or scan the QR code on your phone
3. Click "Begin Experience" on the title screen
4. Select topics to test audio playback and medal awards
5. Check rank progression
6. Complete experience to see conclusion screen

[Open Simulator](#open-simulator)

## 🎨 Branding Customization

### Title Screen
Edit `/src/components/TitleScreen.ts`:
- Change title text (line 41)
- Change subtitle (line 52)
- Update instructions (line 75-82)
- Change colors and styling

### Splash Screen
Edit `/index.html`:
- Update title (line 6)
- Change launch button text (line 19)

## 📊 Game Data Structure

### Topics
- **id**: Unique identifier
- **title**: Display name
- **description**: Brief explanation
- **audioFile**: Path to audio narration
- **difficulty**: 1-5 (affects points earned)
- **medalId**: Medal awarded on completion
- **completed**: Tracking flag
- **quizQuestions**: Array of quiz questions (optional)

### Quiz Questions
- **id**: Unique identifier
- **question**: The question text
- **options**: Array of 4 answer choices
- **correctAnswer**: Index (0-3) of the correct option

### Medals
- **id**: Unique identifier
- **name**: Medal display name
- **description**: How to earn
- **earned**: Tracking flag

### Ranks (by score/medals)
- Recruit: 0 points
- Cadet: 10+ points
- Corporal: 20+ points, 1+ medal
- Sergeant: 30+ points, 2+ medals
- Lieutenant: 40+ points, 2+ medals
- Captain: 50+ points, 3+ medals
- Colonel: 60+ points, 3+ medals

### Scoring
- **Topic completion**: 10 × difficulty level points
- **Correct quiz answer**: +5 bonus points each
- **Example**: Topic with difficulty 3 + 3 correct quiz answers = 30 + 15 = 45 points

## 🔧 Advanced Customization

### Add More Screens
Create new components in `/src/components/` following the pattern of `TitleScreen.ts`

### Add Animations
Use the animation system in Scene.zcomp to animate 3D medals

### Add 3D Models
Import `.glb` files and display them when medals are earned

### Save Progress
Implement localStorage to save player progress between sessions

### Leaderboard
Add a backend service to track high scores across all players

## 🐛 Troubleshooting

**Audio not playing?**
- Check file paths in GameState.ts
- Ensure audio files exist in /audio folder
- Check browser console for errors

**UI not showing?**
- Check that all components are initialized in index.ts
- Verify ScreenManager is switching screens correctly

**Ranks not updating?**
- Check the updateRank() logic in GameState.ts
- Verify score and medal counts are correct

## 📚 Resources

- [Mattercraft Documentation](https://docs.mattercraft.io)
- [The Citadel History](https://www.citadel.edu)
- Star of the West historical information

## ✨ Future Enhancements

- [ ] QR code scanning functionality
- [ ] Multiple locations support
- [ ] Time-based challenges
- [ ] Multiplayer features
- [ ] Photo capture with AR medals
- [ ] Social sharing
- [ ] Progress saving
- [ ] Achievement badges beyond medals
