# ios/Frameworks — Document Reader native runtimes

Drop from the FacePlugin Drive **iOS** pack (same as `DocumentReader-iOS-App`):

1. `docsdk.framework` (includes `dcr.fpk` + nested engine under `Frameworks/dcrcore.framework` or `Frameworks/DocumentReaderCore.framework`)

Then from `example/ios` run `pod install`.

Header stubs alone are not enough to run on device.

For **customer apps**, copy the same folder to `node_modules/document-reader-sdk/ios/Frameworks/docsdk.framework` after `yarn add`.
