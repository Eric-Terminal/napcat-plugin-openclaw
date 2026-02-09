export interface PluginConfig {
  openclaw: {
    token: string;
    gatewayUrl: string;
    cliPath: string;
  };
  behavior: {
    privateChat: boolean;
    groupAtOnly: boolean;
    userWhitelist: number[];
    groupWhitelist: number[];
  };
}

export interface ExtractedMedia {
  type: 'image' | 'file' | 'voice' | 'video';
  url: string;
  name?: string;
}

export interface ExtractedMessage {
  extractedText: string;
  extractedMedia: ExtractedMedia[];
}

export interface ChatEventPayload {
  sessionKey: string;
  runId: string;
  state: 'delta' | 'final' | 'aborted' | 'error';
  message?: string | MessageContent;
  errorMessage?: string;
}

export interface MessageContent {
  content?: ContentBlock[] | ContentBlock;
  stopReason?: string;
}

export interface ContentBlock {
  type?: string;
  text?: string;
}
