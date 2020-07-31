import { Injectable } from "@angular/core";
import { AngularFirestore } from "@angular/fire/firestore";
import { map, take } from "rxjs/operators";
import { Subscription } from "rxjs";
import { Store } from "@ngrx/store";

import { Exercise } from "./exercise.model";
import { UIService } from "../shared/ui.service";
import * as UI from "../shared/ui.actions";
import * as training from "./training.actions";
import * as fromTraining from "./training.reducer";

@Injectable()
export class TrainingService {
  private fbSubs: Subscription[] = [];

  constructor(
    private db: AngularFirestore,
    private uiService: UIService,
    private store: Store<fromTraining.State>,
  ) {}

  fetchAvailableExercises() {
    this.store.dispatch(new UI.StartLoading());
    this.fbSubs.push(
      this.db
        .collection("availableExercises")
        .snapshotChanges()
        .pipe(
          map((docArray) => {
            return docArray.map((doc) => {
              return {
                id: doc.payload.doc.id,
                name: doc.payload.doc.data()["name"],
                duration: doc.payload.doc.data()["duration"],
                calories: doc.payload.doc.data()["calories"],
              };
            });
          }),
        )
        .subscribe((exercises: Exercise[]) => {
          this.store.dispatch(new UI.StopLoading());
          this.store.dispatch(new training.SetAvailableTrainings(exercises));
        }, (error) => {
          this.store.dispatch(new UI.StopLoading());
          this.uiService.showSnackbar(
            "Fetching Exercise failed, please try again later",
            null,
            3000,
          );
        }),
    );
  }

  startExercise(selectedId: string) {
    this.store.dispatch(new training.StartTraining(selectedId));
  }

  completeExercise() {
    this.store.select(fromTraining.getActiveTraining).pipe(take(1)).subscribe(
      (ex) => {
        this.addDataToDatabase({
          ...ex,
          date: new Date(),
          state: "completed",
        });
        this.store.dispatch(new training.StopTraining());
      },
    );
  }

  cancelExercise(progress: number) {
    this.store.select(fromTraining.getActiveTraining).pipe(take(1)).subscribe(
      (ex) => {
        this.addDataToDatabase({
          ...ex,
          duration: ex.duration * (progress / 100),
          calories: ex.calories * (progress / 100),
          date: new Date(),
          state: "cancelled",
        });
        this.store.dispatch(new training.StopTraining());
      },
    );
  }

  fetchCompletedOrCancelledExercises() {
    this.fbSubs.push(
      this.db.collection("finshedExercise").valueChanges().subscribe(
        (exercises: Exercise[]) => {
          this.store.dispatch(new training.SetFinishedTrainings(exercises));
        },
      ),
    );
  }

  cancelSubscriptions() {
    this.fbSubs.forEach((sub) => sub.unsubscribe());
  }

  private addDataToDatabase(exercise: Exercise) {
    this.db.collection("finshedExercise").add(exercise);
  }
}
