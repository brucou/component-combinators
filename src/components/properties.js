import { always} from 'ramda';

export const EV_GUARD_NONE = null;
export const AR_GUARD_NONE = null;
export const ACTION_REQUEST_NONE = null;
export const ACTION_GUARD_NONE = always(true);
export const ZERO_DRIVER = null;
export const [EVENT_PREFIX, DRIVER_PREFIX, INIT_PREFIX] = ['events', 'drivers', 'init'];
export const INIT_EVENT_NAME = 'init_event';
export const AWAITING_EVENTS = 'AWAITING_EVENTS';
export const AWAITING_RESPONSE = 'AWAITING_RESPONSE';
export const INIT_STATE = 'INIT';

// Error messages
export const ERROR_MESSAGE_PREFIX = 'ERROR : '
export const CONTRACT_SATISFIED_GUARD_PER_ACTION_RESPONSE =
  `For each action response, there MUST be a configured guard which is satisfied!`;
