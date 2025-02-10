import bodyParser from "body-parser";
import express from "express";
import fetch from "node-fetch";
import { BASE_ONION_ROUTER_PORT } from "../config";
import { generateKeys } from "../registry/registry";

export async function simpleOnionRouter(nodeId: number) {
  const onionRouter = express();
  onionRouter.use(express.json());
  onionRouter.use(bodyParser.json());

  // Déclaration des variables pour stocker les messages et la destination
  let lastReceivedEncryptedMessage: string | null = null;
  let lastReceivedDecryptedMessage: string | null = null;
  let lastMessageDestination: number | null = null;

  // Générer une paire de clés unique pour ce nœud
  const { pubKey, privKey } = generateKeys();

  // Enregistrer le nœud sur le registre
  await fetch("http://localhost:5000/registerNode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nodeId,
      pubKey,
      privateKey: privKey, // Envoyer la clé privée pour qu'elle soit stockée
    }),
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
