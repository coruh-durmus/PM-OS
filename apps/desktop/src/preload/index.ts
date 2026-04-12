import { contextBridge, ipcRenderer } from 'electron';
import type { PanelBounds, WebContentsViewOptions, WebContentsViewState } from '@pm-os/types';

const api = {
  wcv: {
    create(options: WebContentsViewOptions): Promise<string> {
      return ipcRenderer.invoke('wcv:create', options);
    },
    navigate(id: string, url: string): Promise<void> {
      return ipcRenderer.invoke('wcv:navigate', id, url);
    },
    setBounds(id: string, bounds: PanelBounds): Promise<void> {
      return ipcRenderer.invoke('wcv:set-bounds', id, bounds);
    },
    destroy(id: string): Promise<void> {
      return ipcRenderer.invoke('wcv:destroy', id);
    },
    getState(id: string): Promise<WebContentsViewState | null> {
      return ipcRenderer.invoke('wcv:get-state', id);
    },
    goBack(id: string): Promise<void> {
      return ipcRenderer.invoke('wcv:go-back', id);
    },
    goForward(id: string): Promise<void> {
      return ipcRenderer.invoke('wcv:go-forward', id);
    },
    reload(id: string): Promise<void> {
      return ipcRenderer.invoke('wcv:reload', id);
    },
    onUrlChanged(callback: (data: { id: string; url: string }) => void): () => void {
      const handler = (_event: Electron.IpcRendererEvent, data: { id: string; url: string }) => callback(data);
      ipcRenderer.on('wcv:url-changed', handler);
      return () => ipcRenderer.removeListener('wcv:url-changed', handler);
    },
    onTitleChanged(callback: (data: { id: string; title: string }) => void): () => void {
      const handler = (_event: Electron.IpcRendererEvent, data: { id: string; title: string }) => callback(data);
      ipcRenderer.on('wcv:title-changed', handler);
      return () => ipcRenderer.removeListener('wcv:title-changed', handler);
    },
    onLoading(callback: (data: { id: string; loading: boolean }) => void): () => void {
      const handler = (_event: Electron.IpcRendererEvent, data: { id: string; loading: boolean }) => callback(data);
      ipcRenderer.on('wcv:loading', handler);
      return () => ipcRenderer.removeListener('wcv:loading', handler);
    },
  },
  dialog: {
    openDirectory(): Promise<string | null> {
      return ipcRenderer.invoke('dialog:open-directory');
    },
  },
};

contextBridge.exposeInMainWorld('pmOs', api);

export type PmOsApi = typeof api;
