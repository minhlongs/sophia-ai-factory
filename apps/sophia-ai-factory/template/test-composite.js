const { registerRoot, Composition } = require('remotion');
const React = require('react');

const MyVideo = () => {
  return React.createElement('div', {
    style: {
      flex: 1,
      backgroundColor: 'black',
      color: 'white',
      justifyContent: 'center',
      alignItems: 'center',
      display: 'flex',
      fontSize: '40px',
      fontFamily: 'sans-serif'
    }
  }, 'Sophia AI Factory test composite render');
};

const RemotionVideo = () => {
  return React.createElement(Composition, {
    id: 'test-composite',
    component: MyVideo,
    durationInFrames: 30,
    fps: 30,
    width: 1920,
    height: 1080,
  });
};

registerRoot(RemotionVideo);
