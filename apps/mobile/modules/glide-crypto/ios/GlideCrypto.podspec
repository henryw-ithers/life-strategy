Pod::Spec.new do |s|
  s.name           = 'GlideCrypto'
  s.version        = '1.0.0'
  s.summary        = "Glide's backup cryptography, entirely Apple's own frameworks."
  s.description    = <<-DESC
    AES-256-GCM via CryptoKit and PBKDF2-HMAC-SHA256 via CommonCrypto.
    Deliberately thin: it exposes two primitives and holds no policy.
    Shipping only Apple-provided cryptography is what keeps the app
    export-exempt (ADR-0020), so this pod must never grow a bundled
    third-party algorithm.
  DESC
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '15.1',
    :tvos => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
