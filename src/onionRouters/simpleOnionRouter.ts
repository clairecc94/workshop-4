import bodyParser from "body-parser";
import express from "express";
import { generateKeyPairSync } from 'crypto';
import { BASE_ONION_ROUTER_PORT } from "../config";

// Fonction pour générer une paire de clés publique et privée
export function generateKeys() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  return {
    pubKey: Buffer.from(publicKey).toString('base64'), // Convertir en base64
    privKey: Buffer.from(privateKey).toString('base64'), // Convertir en base64
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

  // Route pour recevoir un message
  onionRouter.post("/message", (req, res) => {
    const { message } = req.body;
    if (message) {
      lastReceivedMessage = message; // Stocker le message reçu
      res.send("success");
    } else {
      res.status(400).send("Message is required");
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
