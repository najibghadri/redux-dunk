

<p align="center"><img width="320" src="https://user-images.githubusercontent.com/11639734/108255304-61ff8e00-715c-11eb-8dca-30544a097424.png"></p>

---

Effect management in redux, inspired by loop

Shape of an Effect:

`({ dispatch, getState }) => any`

Shape of an EffectCreator:

`(...extraParams) => ({ dispatch, getState }) => any`

Usage examples in reducer:

return dunk(newState) - does nothing interesting
return dunk(newState, Effects.doTheThing) - paramterless Effect
return dunk(newState, Effects.reorderTopic(action.payload.topicId, action.payload.to)); - effect created with parameters


- Effects are always scheduled after the reducer has finished.
- Effects run async (end of current event-loop tick)
- getState always returns the latest state in the store
- avoid never-ending loops (action->reducer->effect->action->..)

## Api Reference

Delay(ms, effect) - run effect after ms delay
Sequence(…effects) - run effects in order waiting for promise to resolve. if one fails the effect fails
Par(…effects) - same as dunk(state, …effects), starts running effects parallelly
Catch(effect, failEffect) try to run effect if it fails run the failEffect
NoOp() - effect that does nothing

## Testing
## Comparison with redux-loop

**Loop command shape:**

... recreate Loop with LoopCmd

### Commonalities

- Same architecture **action -> reducer -> effect** separation (effect = command in loop)
- Same flow: reducer changes state first, *then* dunked Effect start running (however an Effect can be composed from Effects)
- Typed Effects/Commands
- Redux store can be used the same way

### Pros cons with loop
 - Effects are composable, it's a monad basically
 - Robust effect api: extraParams, getState, dispatch
 - You are free in your effects, no babysitting success/fail action restrictions
 - Understandable effects: explicit dispatch calls, no mind  wrapped args, no spaghetti thinking
 - Smaller library, same functionality
 - Cool effect creator helpers out of the box: Delay, Cancelable, TakeOne, LoopCommand, Retry, Poll, Race
 - Written in Typescript

### Cons over loop
- Effect type doesn't tell which actions will be dispatched (because they are within the code body)
- More freedom in effects might lead to bad code?
- Loop is strict

