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

import mapValues from 'lodash/mapValues';
import { AnyApiFactory, ApiRef } from './types';

/**
 * Handles the actual on-demand instantiation and memoization of APIs out of
 * an {@link ApiFactoryHolder}.
 *
 * @public
 */
export class ApiResolver {
  /**
   * Creates an API resolver that holds no APIs.
   */
  static empty(): ApiResolver {
    return new ApiResolver();
  }

  /**
   * Creates an API resolved that instantiates and holds a set of initial APIs.
   *
   * @param factories - The set of API factories to instantiate
   */
  static with(factories: AnyApiFactory[]): ApiResolver {
    return new ApiResolver().with(factories);
  }

  constructor(private readonly apis: Map<string, unknown> = new Map()) {}

  /**
   * Creates a new API resolver, that holds both the APIs that were in the
   * original resolver and the ones created by the given factories.
   *
   * @remarks
   *
   * The factories' dependencies must either be resolved by each other in the
   * given array, or by the APIs that existed in the original resolver.
   *
   * Any attempt to overwrite an already registered API will be rejected.
   *
   * @param factories - The set of API factories to merge with
   * @returns A new resolver instance, leaving the original unchanged
   */
  with(factories: AnyApiFactory[]): ApiResolver {
    const apis = new Map(this.apis);

    // Arrange the factories such that dependencies appear before all dependents
    const queue: AnyApiFactory[] = [];

    function enqueueDepthFirst(factory: AnyApiFactory, seen: string[]) {
      for (const depRef of Object.values(factory.deps)) {
        if (seen.includes(depRef.id)) {
          throw new Error(
            `Circular API dependencies: ${seen.join(' -> ')} -> ${depRef.id}`,
          );
        }
        if (!apis.has(depRef.id)) {
          const depFactory = factories.find(f => f.api.id === depRef.id);
          if (!depFactory) {
            throw new Error(
              `Could not resolve API dependency in chain, ${seen.join(
                ' -> ',
              )} -> ${depRef.id}`,
            );
          }
          enqueueDepthFirst(depFactory, [...seen, depRef.id]);
        }
      }

      if (!queue.includes(factory)) {
        queue.push(factory);
      }
    }

    for (const factory of factories) {
      if (apis.has(factory.api.id)) {
        throw new Error(`API ${factory.api.id} was already registered`);
      }
      enqueueDepthFirst(factory, [factory.api.id]);
    }

    for (const factory of queue) {
      const dependencies = mapValues(factory.deps, ref => apis.get(ref.id));
      apis.set(factory.api.id, factory.factory(dependencies));
    }

    return new ApiResolver(apis);
  }

  resolve<T>(ref: ApiRef<T>): T | undefined {
    return this.apis.get(ref.id) as T | undefined;
  }
}
