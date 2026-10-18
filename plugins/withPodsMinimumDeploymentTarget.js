// Sube la versión mínima de iOS de todos los pods a la de la app (16.4, ver
// expo-build-properties en app.json).
//
// Xcode 27 rechaza compilar targets con IPHONEOS_DEPLOYMENT_TARGET < 15.0, y
// algunos pods viejos (ZXingObjC, que usa expo-camera para leer QR) todavía
// declaran 9.0 o 12.4. Como `ios/` se regenera con prebuild, el ajuste vive
// aquí y se inyecta en el post_install del Podfile.
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# parknow: minimum pods deployment target';
const MINIMUM = '16.4';

module.exports = function withPodsMinimumDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');
      if (!contents.includes(MARKER)) {
        contents = contents.replace(
          /post_install do \|installer\|\n/,
          `post_install do |installer|
    ${MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |bc|
        current = bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || Gem::Version.new(current) < Gem::Version.new('${MINIMUM}')
          bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MINIMUM}'
        end
      end
    end
`,
        );
        fs.writeFileSync(podfile, contents);
      }
      return cfg;
    },
  ]);
};
