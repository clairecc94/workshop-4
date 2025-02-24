import bodyParser from "body-parser";
import express from "express";
import axios from "axios";
import crypto from "crypto";
import { BASE_USER_PORT } from "../config";

export type SendMessageBody = {
  message: string;
  destinationUserId: number;
};

export async function user(userId: number) {
  const _user = express();
  _user.use(express.json());
  _user.use(bodyParser.json());

  let lastReceivedMessage: string | null = null;
  let lastSentMessage: string | null = null;
  let lastCircuit: number[] | null = null;

  _user.get("/status", (req, res) => {
    res.send("live");
  });

  _user.get("/getLastReceivedMessage", (req, res) => {
    res.json({ result: lastReceivedMessage });
  });

  _user.get("/getLastSentMessage", (req, res) => {
    res.json({ result: lastSentMessage });
    

  });

  _user.get("/getLastCircuit", (req, res) => {
    res.json({ result: lastCircuit });
  });
  


  _user.post("/message", (req, res) => {
    const { message } = req.body;
    lastReceivedMessage = message;
    res.send("success"); // Retourne une réponse en texte brut au lieu d'un objet JSON
  });
  

  _user.post("/sendMessage", async (req, res) => {
    try {
      const { message, destinationUserId }: SendMessageBody = req.body;
  
      const registryResponse = await axios.get("http://localhost:5000/getNodeRegistry");
      const nodes: { nodeId: number; pubKey: string }[] = registryResponse.data.nodes;
  
      if (nodes.length < 3) {
        return res.status(500).json({ error: "Pas assez de nœuds pour créer un circuit" });
      }
  
      function shuffleArray<T>(array: T[]): T[] {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
      }
      
      const circuit = shuffleArray(nodes).slice(0, 3);
      console.log("Circuit choisi :", circuit.map(n => n.nodeId));
      
      const symKeys = circuit.map(() => crypto.randomBytes(32));
  
      let encryptedMessage = message;
      for (let i = circuit.length - 1; i >= 0; i--) {
        const node = circuit[i];
        const symKey = symKeys[i];
  
        const destination =
          i === circuit.length - 1
            ? `000000${BASE_USER_PORT + destinationUserId}`
            : `000000${4000 + circuit[i + 1].nodeId}`;
        const paddedDestination = destination.padStart(10, "0");
  
        const messageWithDestination = paddedDestination + encryptedMessage;
  
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv("aes-256-cbc", symKey, iv);
        const messageBuffer = Buffer.from(messageWithDestination, "utf-8");
        const encryptedLayer = Buffer.concat([cipher.update(messageBuffer), cipher.final()]).toString("base64");

  
        const nodePubKey = Buffer.from(node.pubKey, "base64").toString("utf-8");
        const encryptedSymKey = crypto.publicEncrypt(nodePubKey, symKey).toString("base64");
  
        encryptedMessage = encryptedSymKey + encryptedLayer;
      }
  
      const entryNodePort = 4000 + circuit[0].nodeId;
      await axios.post(`http://localhost:${entryNodePort}/message`, { message: encryptedMessage });
  
      lastSentMessage = message;
      return res.json({ success: true, circuit: circuit.map((node) => node.nodeId) });
    } catch (error) {
      console.error("Erreur dans sendMessage:", error);
      return res.status(500).json({ error: "Erreur lors de l'envoi du message" });
    }
  });
  
 
  const server = _user.listen(BASE_USER_PORT + userId, () => {
    console.log(`User ${userId} is listening on port ${BASE_USER_PORT + userId}`);
  });

  return server;
}
