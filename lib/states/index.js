var data = require('./data');
var state = require('./state');
var paginated = require('./paginated');
var booklet = require('./booklet');
var choices = require('./choices');
var freetext = require('./freetext');
var end = require('./end');

this.StateData = data.StateData;

this.StateError = state.StateError;
this.StateInvalidError = state.StateInvalidError;

this.StateSetupEvent = state.StateSetupEvent;
this.StateInputEvent = state.StateInputEvent;
this.StateExitEvent = state.StateExitEvent;
this.StateEnterEvent = state.StateEnterEvent;
this.StateResumeEvent = state.StateResumeEvent;

this.State = state.State;
this.PaginatedState = paginated.PaginatedState;
this.BookletState = booklet.BookletState;
this.Choice = choices.Choice;
this.ChoiceState = choices.ChoiceState;
this.MenuState = choices.MenuState;
this.LanguageChoice = choices.LanguageChoice;
this.PaginatedChoiceState = choices.PaginatedChoiceState;
this.FreeText = freetext.FreeText;
this.EndState = end.EndState;
