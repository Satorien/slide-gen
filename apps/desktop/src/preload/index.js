/**
 * preload — レンダラへ安全な API を公開する(contextIsolation 前提)。
 */
import { contextBridge, ipcRenderer } from "electron";

const api = {
  listThemes: () => ipcRenderer.invoke("themes:list"),
  render: (markdown, theme) => ipcRenderer.invoke("deck:render", { markdown, theme }),
  openFile: () => ipcRenderer.invoke("file:open"),
  saveFile: (content, path) => ipcRenderer.invoke("file:save", { content, path }),
  exportDeck: (markdown, theme, format) =>
    ipcRenderer.invoke("deck:export", { markdown, theme, format }),
  importThemeFromPptx: () => ipcRenderer.invoke("theme:importPptx"),
};

contextBridge.exposeInMainWorld("api", api);
