# BROS2 Desktop

## ROS2 Quickstart (Dev)

Build the local ROS 2 image once before launching the desktop app:

```bash
pnpm --filter ./apps/desktop-app ros:build-image
```

After the app is running (`pnpm -r build` then `pnpm --filter ./apps/desktop-app dev`), open DevTools and use the snippets in the root README to:

- start the runner container
- launch rosbridge (and optionally turtlesim) in the background
- create `ArrowKeyPub` + `TurtleSimSub` in `window.runtime` to drive `/turtle1/cmd_vel`

Tip: in the Workspace header, use the **Start ROS** button to run the same rosbridge+turtlesim setup without opening DevTools.
