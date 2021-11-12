/*
 * Copyright 2021 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Duration } from 'luxon';
import { AbortController, AbortSignal } from 'node-abort-controller';
import { ApiResolver } from './ApiResolver';
import { AnyApiFactory, ApiRef, Context } from './types';

/**
 * A context that is meant to be passed as a ctx variable down the call chain,
 * to pass along scoped information and abort signals.
 *
 * @public
 */
export class RootContext implements Context {
  /**
   * Creates a root context.
   *
   * @remarks
   *
   * This should normally only be called near the root of an application. The
   * created context is meant to be passed down into deeper levels, which may
   * or may not make derived contexts out of it.
   */
  static create(options?: { apis?: ApiResolver }) {
    return new RootContext(
      new AbortController().signal,
      options?.apis ?? ApiResolver.empty(),
    );
  }

  /**
   * Returns an abort signal that triggers when the current context or any of
   * its parents signal for it.
   */
  public readonly abortSignal: AbortSignal;

  /**
   * Returns a promise that resolves when the current context or any of its
   * parents signal to abort.
   */
  public get abortPromise(): Promise<void> {
    return new Promise<void>(resolve => {
      this.abortSignal.addEventListener('abort', resolve);
    });
  }

  private readonly apiResolver: ApiResolver;

  private constructor(abortSignal: AbortSignal, apiResolver: ApiResolver) {
    this.abortSignal = abortSignal;
    this.apiResolver = apiResolver;
  }

  /**
   * Creates a derived context, which signals to abort operations either when
   * any parent context signals, or when the current layer calls the returned
   * abort function.
   *
   * @returns A derived context, and the function that triggers it to abort.
   */
  withAbort(): { ctx: Context; abort: () => void } {
    const newController = new AbortController();
    const abort = newController.abort.bind(newController);
    this.abortSignal.addEventListener('abort', abort);

    const ctx = new RootContext(newController.signal, this.apiResolver);

    return { ctx, abort };
  }

  /**
   * Creates a derived context, which signals to abort operations either when
   * any parent context signals, or when the given amount of time has passed.
   *
   * @param timeout - The duration of time, after which the derived context
   *                  will signal to abort.
   */
  withTimeout(timeout: Duration): Context {
    const newController = new AbortController();

    const timeoutHandle = setTimeout(() => {
      newController.abort();
    }, timeout.as('milliseconds'));

    this.abortSignal.addEventListener('abort', () => {
      clearTimeout(timeoutHandle);
      newController.abort();
    });

    return new RootContext(newController.signal, this.apiResolver);
  }

  /**
   * Creates a derived context, which has the ability to resolve the APIs that
   * the given factory/factories produce.
   */
  withApi(factory: AnyApiFactory | AnyApiFactory[]): Context {
    const newResolver = this.apiResolver.with([factory].flat());
    return new RootContext(this.abortSignal, newResolver);
  }

  resolveApi<Api>(ref: ApiRef<Api>): Api | undefined {
    return this.apiResolver.resolve(ref);
  }
}
