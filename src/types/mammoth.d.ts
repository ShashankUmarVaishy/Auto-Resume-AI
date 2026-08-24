declare module 'mammoth' {
  export interface Options {
    arrayBuffer: ArrayBuffer;
  }
  export interface Result {
    value: string;
    messages: any[];
  }
  export function extractRawText(options: Options): Promise<Result>;
  export function convertToHtml(options: Options): Promise<Result>;
}
