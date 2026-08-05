import { Menu, MenuItemConstructorOptions, app, shell } from "electron";
import { APP_NAME } from "./constants";

export function installApplicationMenu(): void {
      const isMac = process.platform === "darwin";

      const template: MenuItemConstructorOptions[] = [
            ...(isMac
                  ? [
                          {
                                label: APP_NAME,
                                submenu: [{ role: "about" as const }, { type: "separator" as const }, { role: "services" as const }, { type: "separator" as const }, { role: "hide" as const }, { role: "hideOthers" as const }, { role: "unhide" as const }, { type: "separator" as const }, { role: "quit" as const }],
                          },
                    ]
                  : []),
            {
                  label: "Edit",
                  submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }],
            },
            {
                  label: "View",
                  submenu: [{ role: "reload" }, { role: "forceReload" }, { role: "toggleDevTools" }, { type: "separator" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" }, { role: "togglefullscreen" }],
            },
            {
                  label: "Window",
                  submenu: [{ role: "minimize" }, { role: "close" }],
            },
            {
                  label: "Help",
                  submenu: [
                        {
                              label: "Backend README",
                              click: () => shell.openExternal("https://github.com"),
                        },
                  ],
            },
      ];

      Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
