
#ifdef RCT_NEW_ARCH_ENABLED
#import "RNDocumentReaderSdkSpec.h"

@interface DocumentReaderSdk : NSObject <NativeDocumentReaderSdkSpec>
#else
#import <React/RCTBridgeModule.h>

@interface DocumentReaderSdk : NSObject <RCTBridgeModule>
#endif

@end
