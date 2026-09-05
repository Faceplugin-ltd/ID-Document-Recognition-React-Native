# Document Reader — example app

Run the demo from the **repository root README**:

**[../README.md — Run the demo](../README.md#run-the-demo)**

Quick copy:

```bash
# From repository root
yarn && cd example && yarn
# Place runtimes (see main README), then:
bundle install && cd ios && pod install && cd ..
yarn start          # terminal 1
yarn ios --device   # terminal 2 (USB iPhone)
yarn android        # Android (requires documentreadersdk.aar + JDK)
```

Do not follow the generic React Native template below — use the main README instead.
