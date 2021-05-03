import { EffectCreators, dunkMiddleware } from '../src/dunk';
import { createAction } from 'redux-dry-ts-actions';
import configureStore from 'redux-mock-store';

type State = {
    message: string | null;
};

const initialState: State = {
    message: null,
};

const actions = {
    successfulAction: createAction('successful', (message: string) => ({ message })),
    failedAction: createAction('failed'),
};

const { EffectCreator } = EffectCreators<State>();

let fails = false;

const testFetch = async (_: string) => {
    return fails ? Promise.reject() : Promise.resolve({ message: 'hello' });
};

const fetchUser = EffectCreator((userId: number) => async ({ dispatch }) => {
    return testFetch(`/api/users/${userId}`)
        .then(res => dispatch(actions.successfulAction(res.message)))
        .catch(_ => dispatch(actions.failedAction()));
});

const store = configureStore<State>([dunkMiddleware])(initialState);
const mockStoreApi = { dispatch: store.dispatch, getState: store.getState };

beforeEach(() => {
    store.clearActions();
});

test('success case', () => {
    fails = false;
    const expectedAction = actions.successfulAction('hello');

    fetchUser(1)(mockStoreApi).then(() => {
        expect(store.getActions()).toEqual([expectedAction]);
    });
});

test('fail case', () => {
    fails = true;
    const expectedAction = actions.failedAction();

    fetchUser(1)(mockStoreApi).then(() => {
        expect(store.getActions()).toEqual([expectedAction]);
    });
});
