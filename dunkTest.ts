import { EffectCreators, dunkMiddleware } from './dunk';
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
    return fails ? Promise.resolve({ message: 'hello' }) : Promise.reject();
};

const fetchUser = EffectCreator((userId: number) => async ({ dispatch }) => {
    return testFetch(`/api/users/${userId}`)
        .then(res => dispatch(actions.successfulAction(res.message)))
        .catch(_ => dispatch(actions.failedAction()));
});

test('success case', () => {
    const store = configureStore<State>([dunkMiddleware])(initialState);

    fails = false;
    const expectedAction = actions.successfulAction('hello');

    fetchUser(1)({ dispatch: store.dispatch, getState: store.getState }).then(() => {
        expect(store.getActions()).toEqual([expectedAction]);
    });
});

test('fail case', () => {
    const store = configureStore<State>([dunkMiddleware])(initialState);

    fails = true;
    const expectedAction = actions.failedAction();

    fetchUser(1)({ dispatch: store.dispatch, getState: store.getState }).then(() => {
        expect(store.getActions()).toEqual([expectedAction]);
    });
});
