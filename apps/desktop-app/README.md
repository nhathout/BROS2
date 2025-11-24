# BROS2 Desktop

## ROS2 Quickstart (Dev)

Build the local ROS 2 image once before launching the desktop app:

```bash
pnpm --filter ./apps/desktop-app ros:build-image
```

After the app is running (`pnpm -r build` then `pnpm --filter ./apps/desktop-app dev`), open DevTools and execute the runner/runtime snippet from the acceptance checklist to spin up `window.runner`, create a `RosbridgeBridge`, start `ArrowKeyPub`, add a `Forwarder`, and interact with ROS 2 topics.