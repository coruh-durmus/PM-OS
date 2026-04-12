import { Menu, MenuItemConstructorOptions, app, BrowserWindow } from 'electron';
import { WorkspaceManager } from './workspace-manager.js';

export function createAppMenu(workspace: WorkspaceManager): void {
  const isMac = process.platform === 'darwin';

  const recentItems: MenuItemConstructorOptions[] = workspace.getRecent().map(p => ({
    label: p,
    click: () => {
      if (p.endsWith('.pmos-workspace')) {
        workspace.loadWorkspaceFile(p);
      } else {
        workspace.openFolderDirect(p);
      }
    },
  }));

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Folder...',
          accelerator: 'CmdOrCtrl+O',
          click: () => workspace.openFolder(),
        },
        {
          label: 'Open Workspace from File...',
          click: () => workspace.openWorkspaceFromFile(),
        },
        { type: 'separator' },
        {
          label: 'Add Folder to Workspace...',
          click: () => workspace.addFolderToWorkspace(),
          enabled: workspace.isOpen(),
        },
        { type: 'separator' },
        {
          label: 'Open Recent',
          submenu: recentItems.length > 0 ? [
            ...recentItems,
            { type: 'separator' as const },
            { label: 'Clear Recent', click: () => {} },
          ] : [
            { label: 'No Recent Workspaces', enabled: false },
          ],
        },
        { type: 'separator' },
        {
          label: 'Save Workspace As...',
          click: () => workspace.saveWorkspaceAs(),
          enabled: workspace.isOpen(),
        },
        { type: 'separator' },
        {
          label: 'Close Workspace',
          click: () => workspace.closeWorkspace(),
          enabled: workspace.isOpen(),
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const },
        ] : [
          { role: 'close' as const },
        ]),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
