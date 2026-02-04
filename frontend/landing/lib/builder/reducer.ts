import { v4 as uuidv4 } from 'uuid';
import { BuilderAction, BuilderState, COMPONENT_DEFINITIONS, LandingComponent, ComponentPropValue } from './types';

const createComponent = (type: BuilderAction['payload']['type']): LandingComponent => {
  const def = COMPONENT_DEFINITIONS[type];
  return {
    id: uuidv4(),
    type,
    props: def.properties.reduce((acc, prop) => {
      acc[prop.name] = prop.defaultValue;
      return acc;
    }, {} as Record<string, ComponentPropValue>),
  };
};

const pushHistory = (state: BuilderState, components: LandingComponent[]): BuilderState => {
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(components);
  return {
    ...state,
    components,
    history: newHistory,
    historyIndex: newHistory.length - 1,
  };
};

export const initialState: BuilderState = {
  components: [],
  selectedId: null,
  history: [[]],
  historyIndex: 0,
  device: 'desktop',
  metadata: { title: 'Untitled Page', description: '', slug: '', ogImage: '' },
};

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case 'ADD_COMPONENT': {
      const newComponent = createComponent(action.payload.type);
      const newComponents = typeof action.payload.index === 'number'
        ? [...state.components.slice(0, action.payload.index), newComponent, ...state.components.slice(action.payload.index)]
        : [...state.components, newComponent];
      return pushHistory(state, newComponents);
    }

    case 'REMOVE_COMPONENT': {
      const newComponents = state.components.filter(c => c.id !== action.payload.id);
      return pushHistory(state, newComponents);
    }

    case 'UPDATE_COMPONENT': {
      const newComponents = state.components.map(c =>
        c.id === action.payload.id ? { ...c, props: { ...c.props, ...action.payload.props } } : c
      );
      return pushHistory(state, newComponents);
    }

    case 'MOVE_COMPONENT': {
      const { activeId, overId } = action.payload;
      const oldIndex = state.components.findIndex(c => c.id === activeId);
      const newIndex = state.components.findIndex(c => c.id === overId);
      if (oldIndex === -1 || newIndex === -1) return state;
      const newComponents = [...state.components];
      const [moved] = newComponents.splice(oldIndex, 1);
      newComponents.splice(newIndex, 0, moved);
      return pushHistory(state, newComponents);
    }

    case 'SELECT_COMPONENT':
      return { ...state, selectedId: action.payload.id };

    case 'SET_DEVICE':
      return { ...state, device: action.payload.device };

    case 'UPDATE_METADATA':
      return pushHistory(state, state.components);

    case 'UNDO':
      if (state.historyIndex <= 0) return state;
      return { ...state, components: state.history[state.historyIndex - 1], historyIndex: state.historyIndex - 1, selectedId: null };

    case 'REDO':
      if (state.historyIndex >= state.history.length - 1) return state;
      return { ...state, components: state.history[state.historyIndex + 1], historyIndex: state.historyIndex + 1, selectedId: null };

    case 'LOAD_TEMPLATE':
      return pushHistory(state, action.payload.components);

    default:
      return state;
  }
}
