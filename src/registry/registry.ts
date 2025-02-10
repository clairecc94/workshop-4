import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { REGISTRY_PORT } from "../config";
import crypto from "crypto";

export type Node = { nodeId: number; pubKey: string; privateKey: string };

export type RegisterNodeBody = {
  nodeId: number;
  pubKey: string;
  privateKey: string;
};

export type GetNodeRegistryBody = {
  nodes: { nodeId: number; pubKey: string }[];
};

const registeredNodes: RegisterNodeBody[] = [];
type Payload = {
  result: string; // La chaîne est la version base64 de la clé privée
};


export async function launchRegistry() {
  const _registry = express();
  _registry.use(express.json());
  _registry.use(bodyParser.json());

  // Vérifier si le registre est en ligne
  _registry.get("/status", (req, res) => {
    res.send("live");
  });

  _registry.post("/registerNode", (req: Request, res: Response) => {
    const { nodeId, pubKey, privateKey }: RegisterNodeBody = req.body;
  
    // Vérifier si le nœud est déjà enregistré
    if (registeredNodes.some((node) => node.nodeId === nodeId)) {
      return res.status(400).json({ message: "Node already registered" });
    }
  
    // Ajouter le nœud à la liste
    registeredNodes.push({ nodeId, pubKey, privateKey });
  
    // Retourner une réponse de succès
    return res.status(201).json({ message: "Node registered successfully" });
  });
  

  // Permettre de récupérer la clé privée d'un nœud spécifique
  _registry.get("/getPrivateKey", (req: Request, res: Response) => {
    const nodeId = Number(req.query.nodeId);  // Récupérer l'ID du nœud depuis les paramètres de la requête
    const node = registeredNodes.find((n) => n.nodeId === nodeId);  // Chercher le nœud par son ID
  
    if (node) {
      // Si le nœud est trouvé, encoder la clé privée en base64 et la renvoyer dans le payload
      const base64PrivateKey = Buffer.from(node.privateKey).toString('base64');
      return res.json({ result: base64PrivateKey });  // Réponse avec le format attendu
    } else {
      // Si le nœud n'est pas trouvé, retourner une erreur 404
      return res.status(404).json({ message: "Node not found" });
    }
  });
  // Récupérer la liste des nœuds avec seulement leur ID et clé publique
  _registry.get("/getNodeRegistry", (req: Request, res: Response) => {
    const response: GetNodeRegistryBody = {
      nodes: registeredNodes.map(({ nodeId, pubKey }) => ({ nodeId, pubKey })),
    };
    res.json(response);
  });

  // Démarrer le serveur
  const server = _registry.listen(REGISTRY_PORT, () => {
    console.log(`Registry is listening on port ${REGISTRY_PORT}`);
  });

  return server;
}

// Générer une paire de clés pour un nœud
export function generateKeys(): { pubKey: string; privKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });

  return {
    pubKey: publicKey.export({ type: "spki", format: "pem" }).toString("base64"),
    privKey: privateKey.export({ type: "pkcs1", format: "pem" }).toString("base64"),
  };
}
