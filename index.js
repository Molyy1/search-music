const express = require("express");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const https = require("https");

const app = express();
const PORT = 3000;
const API_KEY = "AIzaSyDBV2IhZJgJ2OIYqn1sfiHGmdXUXhWNc_M"; // Replace with your YouTube API key

// Serve the HTML file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Endpoint to search for music and download it
app.get("/sing", async (req, res) => {
  const query = req.query.query;
  if (!query) {
    return res.status(400).send("Please provide a query.");
  }

  try {
    const searchResult = await searchYouTubeVideo(query);
    if (!searchResult) {
      return res.status(404).send("No music found.");
    }

    const musicUrl = searchResult.url;
    const musicTitle = searchResult.title;

    const downloadUrl = await OutputUrl(musicUrl);
    if (!downloadUrl) {
      return res.status(500).send("No working music links found.");
    }

    const sanitizedTitle = sanitizeTitle(musicTitle);
    const fileName = `${sanitizedTitle}.mp3`;
    const ytaudioDir = path.join(__dirname, "ytaudio");
    const filePath = path.join(ytaudioDir, fileName);

    // Check if the file already exists
    if (fs.existsSync(filePath)) {
      return res.json({
        title: musicTitle,
        listenPath: `/audio/${fileName}`,
        downloadPath: `/download/${fileName}`,
      });
    }

    fs.ensureDirSync(ytaudioDir);

    const file = fs.createWriteStream(filePath);
    https.get(downloadUrl, function(response) {
      response.pipe(file);
      file.on("finish", function() {
        file.close(() => {
          console.info("[DOWNLOADER] Downloaded");

          res.json({
            title: musicTitle,
            listenPath: `/audio/${fileName}`,
            downloadPath: `/download/${fileName}`,
          });
        });
      });
    }).on("error", function(err) {
      console.error("[ERROR]", err);
      res.status(500).send("Error while downloading the file.");
    });
  } catch (error) {
    console.error("[ERROR]", error);
    res.status(500).send("Internal server error.");
  }
});

// Serve the downloaded music to be played
app.use("/audio", express.static(path.join(__dirname, "ytaudio")));

// Serve music for download
app.get("/download/:file", (req, res) => {
  const file = path.join(__dirname, "ytaudio", req.params.file);
  if (fs.existsSync(file)) {
    res.download(file);
  } else {
    res.status(404).send("File not found.");
  }
});

// YouTube Search Function
async function searchYouTubeVideo(query) {
  try {
    const response = await axios.get("https://www.googleapis.com/youtube/v3/search", {
      params: {
        part: "snippet",
        q: query,
        key: API_KEY,
        type: "video",
        maxResults: 1,
      },
    });

    if (response.data.items && response.data.items.length > 0) {
      const video = response.data.items[0];
      const videoTitle = video.snippet.title;
      const videoId = video.id.videoId;
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      return { title: videoTitle, url: videoUrl };
    } else {
      console.log("No videos found for your query.");
      return null;
    }
  } catch (error) {
    console.error("Error fetching data from YouTube API:", error);
    return null;
  }
}

// Function to get the download URL from cnvmp3.com
async function OutputUrl(url) {
  try {
    const payload = {
      filenamePattern: "pretty",
      isAudioOnly: true,
      url: url,
    };

    const response = await axios.post("https://cnvmp3.com/fetch.php", payload);
    return response.data.url;
  } catch (error) {
    console.error("Error in OutputUrl:", error);
    throw error;
  }
}

// Utility function to sanitize filenames
function sanitizeTitle(title) {
  return title.replace(/[\/\?<>\\:\*\|":]/g, "-"); // Replace illegal filename characters
}

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
