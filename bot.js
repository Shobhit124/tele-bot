import express from 'express';
import fetch from 'node-fetch';
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';

// Use your Telegram bot token
const telegramToken = process.env.TELE_TOKEN; 
const bot = new TelegramBot(telegramToken, { polling: true });

// Use your Hugging Face API Key
const huggingFaceAPIKey = process.env.HUGGINGFACE_API_KEY;
const huggingFaceURL = process.env.HUGGINGFACE_URL;

// Create an Express app
const app = express();
const port = process.env.PORT;

// Middleware to parse incoming JSON
app.use(express.json());

// Route for testing the server
app.get('/', (req, res) => {
  res.send('Telegram Bot and Hugging Face Image Generator Server is Running!');
});

// Listen for incoming messages from Telegram
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const prompt = msg.text; // The prompt the user sends to the bot

  // Notify the user that the image is being generated
  bot.sendMessage(chatId, "🖼️✨ Generating your image... Please wait a moment! ⏳🎨");

  try {
    // Make the request to Hugging Face API
    const response = await fetch(huggingFaceURL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${huggingFaceAPIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    // Response is an image (JPEG)
    const imageStream = response.body; // This returns a readable stream of the image

    // Get the current directory path
    const currentDirectory = path.dirname(new URL(import.meta.url).pathname);

    // Ensure the directory exists or create it
    const imageDir = path.join(currentDirectory, 'images');
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true }); // Ensure the directory is created
    }

    // Define the path to save the image
    const imagePath = path.join(imageDir, 'generated_image.jpg');
    console.log(`Saving image to: ${imagePath}`);  // Log the path for debugging

    // Create a write stream and pipe the image stream to it
    const fileStream = fs.createWriteStream(imagePath);
    imageStream.pipe(fileStream);

    // Wait for the file to be written
    fileStream.on('finish', async () => {
      // Check if the file exists
      if (fs.existsSync(imagePath)) {
        console.log('Image saved successfully.');

        // Send the image back to the user
        try {
          await bot.sendPhoto(chatId, imagePath, { caption: `🎉 Here is your generated image based on the prompt: ${msg.text} 🖼️✨` });
          
          // Clean up the generated image file after sending it
          fs.unlinkSync(imagePath);
        } catch (err) {
          console.error('Error sending image:', err);
          bot.sendMessage(chatId, 'Failed to send the image. Please try again later.');
        }
      } else {
        bot.sendMessage(chatId, 'Failed to save the image. Please try again later.');
      }
    });

    fileStream.on('error', (error) => {
      console.error('Error saving image:', error);
      bot.sendMessage(chatId, `An error occurred while saving the image: ${error.message}`);
    });

  } catch (error) {
    console.error('Error generating image:', error);
    bot.sendMessage(chatId, `An error occurred: ${error.message}`);
  }
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
