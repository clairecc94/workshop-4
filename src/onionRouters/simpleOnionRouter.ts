import bodyParser from "body-parser";
import express from "express";
import { generateKeyPairSync } from 'crypto';
import { BASE_ONION_ROUTER_PORT } from "../config";
import crypto, { privateDecrypt } from "crypto";
import axios from "axios";

// Fonction pour générer une paire de clés publique et privée
export function generateKeys() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  return {
    pubKey: Buffer.from(publicKey.replace(/\n/g, "")).toString("base64"), // Enlève les sauts de ligne
    privKey: Buffer.from(privateKey.replace(/\n/g, "")).toString("base64"),
  };
}



export async function simpleOnionRouter(nodeId: number) {
  const onionRouter = express();
  onionRouter.use(express.json());
  onionRouter.use(bodyParser.json());

  // Déclaration des variables pour stocker les messages et la destination
  let lastReceivedEncryptedMessage: string | null = null;
  let lastReceivedDecryptedMessage: string | null = null;
  let lastMessageDestination: number | null = null;
  let lastReceivedMessage: string | null = null; // Ajoutez cette ligne

  // Générer une paire de clés unique pour ce nœud
  const { pubKey, privKey } = generateKeys();

  // Enregistrer le nœud sur le registre
  await fetch("http://localhost:5000/registerNode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nodeId,
      pubKey, 
      privKey,
    }),
  });

  function importPrivateKey(privateKeyBase64: string): string {
    return Buffer.from(privateKeyBase64, "base64").toString("utf-8");
  }
  
  // Fonction de déchiffrement RSA
  function rsaDecrypt(encryptedMessage: string, privateKeyPem: string): Buffer {
    return privateDecrypt(privateKeyPem, Buffer.from(encryptedMessage, "base64"));
  }
  
  // Fonction de déchiffrement AES
  function aesDecrypt(encryptedMessage: string, key: Buffer, iv: Buffer): string {
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedMessage, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf-8");
  }

  // Route pour recevoir un message
  onionRouter.post("/message", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).send("Message is required");
  
      lastReceivedEncryptedMessage = message;
  
      // Récupérer la clé privée du nœud
      const privateKeyPem = importPrivateKey(privKey);
  
      // Séparer la clé symétrique chiffrée et le message chiffré
      const encryptedSymKey = message.slice(0, 344); // RSA-2048 produit 344 caractères en base64
      const encryptedLayer = message.slice(344);
  
      // Déchiffrer la clé symétrique avec la clé privée du nœud
      const symKey = rsaDecrypt(encryptedSymKey, privateKeyPem);
  
      // Extraire l'IV (16 premiers bytes du message chiffré)
      const iv = Buffer.from(encryptedLayer.slice(0, 24), "base64");
      const encryptedPayload = encryptedLayer.slice(24);
  
      // Déchiffrer la couche du message avec AES
      const decryptedLayer = aesDecrypt(encryptedPayload, symKey, iv);
      lastReceivedDecryptedMessage = decryptedLayer;
  
      // Extraire la destination (10 premiers caractères)
      const destination = decryptedLayer.slice(0, 10);
      const nextMessage = decryptedLayer.slice(10);
  
      // Déterminer où envoyer le message
      const destinationPort = parseInt(destination, 10);
      lastMessageDestination = destinationPort;
  
      console.log(`🔹 Nœud ${nodeId} a reçu un message.`);
      console.log(`   ➡ Destination: ${destinationPort}`);
      console.log(`   🔓 Message déchiffré: ${nextMessage}`);
  
      // Transmettre au prochain nœud ou utilisateur
      await axios.post(`http://localhost:${destinationPort}/message`, { message: nextMessage });
  
      return res.send({ success: true }); // ✅ Ajout du return ici
    } catch (error) {
      console.error("Erreur lors du traitement du message:", error);
      return res.status(500).json({ error: "Erreur interne du serveur" }); // ✅ Ajout du return ici
    }
  });
  

  // Route pour obtenir le dernier message reçu
  onionRouter.get("/getLastReceivedMessage", (req, res) => {
    res.json({ result: lastReceivedMessage });
  });

  // Route de statut
  onionRouter.get("/status", (req, res) => {
    res.send("live");
  });

  // Route pour obtenir le dernier message reçu (chiffré)
  onionRouter.get("/getLastReceivedEncryptedMessage", (req, res) => {
    res.json({ result: lastReceivedEncryptedMessage });
  });

  // Route pour obtenir le dernier message reçu (déchiffré)
  onionRouter.get("/getLastReceivedDecryptedMessage", (req, res) => {
    res.json({ result: lastReceivedDecryptedMessage });
  });

  // Route pour obtenir la destination du dernier message
  onionRouter.get("/getLastMessageDestination", (req, res) => {
    res.json({ result: lastMessageDestination });
  });
  onionRouter.get("/getPrivateKey", (req, res) => {
    res.json({ result: privKey });
  });
  

  // Démarrer le serveur
  const server = onionRouter.listen(BASE_ONION_ROUTER_PORT + nodeId, () => {
    console.log(
      `Onion router ${nodeId} is listening on port ${
        BASE_ONION_ROUTER_PORT + nodeId
      }`
    );
  });

  return server;
}
