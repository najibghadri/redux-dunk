import { Dispatch, Middleware, AnyAction } from 'redux';
export interface Effect<State = any, ActionType extends AnyAction = AnyAction, ReturnType = any> {
    (storeApi: { dispatch: Dispatch<ActionType>; getState: () => State }): Promise<ReturnType>;
}

export interface EffectApi<State = any, ActionType extends AnyAction = AnyAction, ReturnType = any> {
    andThen: <NextReturnType = any>(
        ef: Effect<State, ActionType, NextReturnType>,
    ) => Effect<State, ActionType, NextReturnType> & EffectApi<State, ActionType, NextReturnType>;

    fmap: <NextReturnType = any>(
        f: (res: ReturnType) => Effect<State, ActionType, NextReturnType>,
    ) => Effect<State, ActionType, NextReturnType> & EffectApi<State, ActionType, NextReturnType>;
    // catch:
    // fold:
    // sleep:
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
        const effApi: EffectApi<State, ActionType, ReturnType> = {
            andThen: ef => Effect(storeApi => effect(storeApi).then(_ => ef(storeApi))),
            fmap: f => Effect(storeApi => effect(storeApi).then(res => f(res)(storeApi))),
        };
        const eff = Object.assign<
            (storeApi: { dispatch: Dispatch<ActionType>; getState: () => State }) => Promise<ReturnType>,
            EffectApi<State, ActionType, ReturnType>
        >(effect, effApi);
        return eff;
    }

    function EffectCreator<Params extends Array<unknown> = [], ReturnType = any>(
        effectCreator: (
            ...params: Params
        ) => (storeApi: { dispatch: Dispatch<ActionType>; getState: () => State }) => Promise<ReturnType>,
    ) {
        const effCreator = (...params: Params) => Effect(effectCreator(...params));
        return effCreator;
    }

    function Delay<ReturnType = any>(ms: number, effect: Effect<State, ActionType, ReturnType>) {
        return Effect(storeApi => {
            return new Promise(resolve => setTimeout(resolve, ms)).then(() => effect(storeApi));
        });
    }

    function Sequence(...effects: Effect<State, ActionType, any>[]) {
        return Effect(async storeApi => {
            return effects.reduce((composed, effect) => {
                return composed.then(() => effect(storeApi));
            }, Promise.resolve());
        });
    }

    function Par(...effects: Effect<State, ActionType, any>[]) {
        return Effect(async storeApi => {
            return effects.forEach(effect => effect(storeApi));
        });
    }

    function Catch<ReturnTypeSuccess = any, ReturnTypeFail = any>(
        effect: Effect<State, ActionType, ReturnTypeSuccess>,
        failEffect: Effect<State, ActionType, ReturnTypeFail>,
    ) {
        return Effect<ReturnTypeSuccess | ReturnTypeFail>(storeApi =>
            effect(storeApi).catch(() => failEffect(storeApi)),
        );
    }

    function Do() {
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
        Do,
    };
}
