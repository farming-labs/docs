import { defineDocsHandler } from "@farming-labs/nuxt/server";
import config from "../../docs.config";

export default defineDocsHandler(config, useStorage);
