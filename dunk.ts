import { Dispatch, Middleware, AnyAction } from 'redux';
export interface Effect<ReturnType = any> {
    (storeApi: { dispatch: Dispatch<AnyAction>; getState: () => any }): Promise<ReturnType>;
}

let effectQueue: Effect[] = [];

export function dunk<State = any>(nextState: State, ...effects: Effect[]) {
    effectQueue.push(...effects);
    return nextState;
}

export const dunkMiddleware: Middleware = ({ getState, dispatch }) => next => action => {
    next(action); // reducer (and previous middlewares) runs first
    effectQueue.forEach(effect => Promise.resolve().then(() => effect({ getState, dispatch })));
    effectQueue = [];
    return action;
};

export function EffectCreators<State = any, ActionType extends AnyAction = AnyAction>() {
    function Effect<ReturnType = any>(
        effect: (storeApi: { dispatch: Dispatch<ActionType>; getState: () => State }) => Promise<ReturnType>,
    ) {
        return effect;
    }

    function EffectCreator<Params extends Array<unknown> = [], ReturnType = any>(
        effectCreator: (
            ...params: Params
        ) => (storeApi: { dispatch: Dispatch<ActionType>; getState: () => State }) => Promise<ReturnType>,
    ) {
        return effectCreator;
    }

    function Delay<ReturnType = any>(
        ms: number,
        effect: (storeApi: { dispatch: Dispatch<ActionType>; getState: () => State }) => Promise<ReturnType>,
    ) {
        return Effect(storeApi => {
            return new Promise(resolve => setTimeout(resolve, ms)).then(() => effect(storeApi));
        });
    }

    function Sequence(
        ...effects: ((storeApi: { dispatch: Dispatch<ActionType>; getState: () => State }) => Promise<any>)[]
    ) {
        return Effect(async storeApi => {
            return effects.reduce((composed, effect) => {
                return composed.then(() => effect(storeApi));
            }, Promise.resolve());
        });
    }

    function Par(
        ...effects: ((storeApi: { dispatch: Dispatch<ActionType>; getState: () => State }) => Promise<any>)[]
    ) {
        return Effect(async storeApi => {
            return effects.forEach(effect => effect(storeApi));
        });
    }

    function Catch(
        effect: (storeApi: { dispatch: Dispatch<ActionType>; getState: () => State }) => Promise<any>,
        failEffect: (storeApi: { dispatch: Dispatch<ActionType>; getState: () => State }) => Promise<any>,
    ) {
        return Effect(storeApi => effect(storeApi).catch(() => failEffect(storeApi)));
    }

    function NoOp() {
        return Effect(_ => Promise.resolve());
    }

    // planned helpers:
    // Cancelable(cancelAction, effect): promise
    // TakeOne(action): promise, TakeOneThen(action, effect): promise
    // TakeLast (action): promise, TakeLastThen(action, effect) : promise
    // Retry(maxTries, delay, promiseEffect, successAction, failAction): promise
    // Poll(maxTries, delay, promiseEffect, successAction, failAction): promise the same??
    // Throttle(...)
    // Race(promises) example: Race(TakeOne(action), Retry(...)) (aka dispatches are stopped) // read lil more about sags, r they stoppable
    // these might need modifications in the dunk middleware

    return {
        Effect,
        EffectCreator,
        Delay,
        Sequence,
        Par,
        Catch,
        NoOp,
    };
}
