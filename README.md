note-forge

note-forge is a 'fire-and-forget' notes aggregator that aims to remove the organisational friction of other notes apps, allowing the user to fire off multiple notes in quick succession which are automatically sorted.

the tool uses the user's Gemini API to create note titles and catagorisation, and as such the user should be aware of the privacy implications of this approach. future iterations of the tool may include 'bring-your-own-model' functionality. be aware of which information you are comfortable with Google Gemini to handle.

this is my first attempt at 'vibe-coding' an app, so I'm well aware that it's code is probably far from par. feel free to provide feedback!

ta,

luke

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
