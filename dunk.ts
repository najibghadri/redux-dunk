import { Dispatch, Middleware, AnyAction } from 'redux';

export type Effect<State = any, ActionType extends AnyAction = AnyAction, ReturnType = any> = EffectFunction<
    State,
    ActionType,
    ReturnType
> &
    EffectApi<State, ActionType, ReturnType>;

export interface EffectFunction<State = any, ActionType extends AnyAction = AnyAction, ReturnType = any> {
    (storeApi: { dispatch: Dispatch<ActionType>; getState: () => State }): Promise<ReturnType>;
}

export interface EffectApi<State = any, ActionType extends AnyAction = AnyAction, ReturnType = any> {
    andThen: <NextReturnType = any>(
        ef: EffectFunction<State, ActionType, NextReturnType>,
    ) => EffectFunction<State, ActionType, NextReturnType> & EffectApi<State, ActionType, NextReturnType>;

    fmap: <NextReturnType = any>(
        f: (res: ReturnType) => EffectFunction<State, ActionType, NextReturnType>,
    ) => EffectFunction<State, ActionType, NextReturnType> & EffectApi<State, ActionType, NextReturnType>;
    // catch:
    // fold:
    // sleep:
}

let effectQueue: EffectFunction[] = [];

export function dunk<State = any>(nextState: State, ...effects: EffectFunction[]) {
    effectQueue.push(...effects);
    return nextState;
}

export const dunkMiddleware: Middleware = ({ getState, dispatch }) => next => action => {
    next(action); // reducer (and next middlewares) runs first
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

    function Delay<ReturnType = any>(ms: number, effect: EffectFunction<State, ActionType, ReturnType>) {
        return Effect(storeApi => {
            return new Promise(resolve => setTimeout(resolve, ms)).then(() => effect(storeApi));
        });
    }

    function Sequence(...effects: EffectFunction<State, ActionType, any>[]) {
        return Effect(async storeApi => {
            return effects.reduce((composed, effect) => {
                return composed.then(() => effect(storeApi));
            }, Promise.resolve());
        });
    }

    function Par(...effects: EffectFunction<State, ActionType, any>[]) {
        return Effect(async storeApi => {
            return effects.forEach(effect => effect(storeApi));
        });
    }

    function Catch<ReturnTypeSuccess = any, ReturnTypeFail = any>(
        effect: EffectFunction<State, ActionType, ReturnTypeSuccess>,
        failEffect: EffectFunction<State, ActionType, ReturnTypeFail>,
    ) {
        return Effect<ReturnTypeSuccess | ReturnTypeFail>(storeApi =>
            effect(storeApi).catch(() => failEffect(storeApi)),
        );
    }

    const Do = Effect(_ => Promise.resolve());

    const NoOp = Do;

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
        NoOp,
    };
}
