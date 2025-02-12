import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { REGISTRY_PORT } from "../config";
import crypto from "crypto";

export type Node = { nodeId: number; pubKey: string; privateKey: string };

export type RegisterNodeBody = {
  nodeId: number;
  pubKey: string;
  privKey:string;
};

export type GetNodeRegistryBody = {
  nodes: { nodeId: number; pubKey: string }[];
};

const registeredNodes: RegisterNodeBody[] = [];
const privateKeys: Map<number, string> = new Map();

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
    const { nodeId, pubKey, privKey }: RegisterNodeBody = req.body;
  
    if (registeredNodes.some((node) => node.nodeId === nodeId)) {
      return res.status(400).json({ message: "Node already registered" });
    }
  
    registeredNodes.push({ nodeId, pubKey ,privKey});
    privateKeys.set(nodeId, privKey); // Store the private key
  
    return res.status(201).json({ message: "Node registered successfully" });
  });

  _registry.get("/getPrivateKey", (req: Request, res: Response) => {
    const nodeId = Number(req.query.nodeId);
    const privateKey = privateKeys.get(nodeId);
  
    if (privateKey) {
      const base64PrivateKey = Buffer.from(privateKey, 'base64').toString('base64');
      return res.json({ result: base64PrivateKey });
    } else {
      return res.status(404).json({ message: "Node not found" });
    }
  });

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
