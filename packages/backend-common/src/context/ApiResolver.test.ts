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

import { ApiResolver } from './ApiResolver';
import { AnyApiRef, AnyApiFactory } from './types';

function allPermutations<T>(inputArr: T[]): T[][] {
  const result: T[][] = [];
  function permute(arr: T[], m: T[] = []) {
    if (!arr.length) {
      result.push(m);
    } else {
      for (let i = 0; i < arr.length; i++) {
        const curr = arr.slice();
        const next = curr.splice(i, 1);
        permute(curr.slice(), m.concat(next));
      }
    }
  }
  permute(inputArr);
  return result;
}

describe('ApiResolver', () => {
  it('can start empty', () => {
    expect(
      ApiResolver.empty().resolve({ id: 'a' } as AnyApiRef),
    ).toBeUndefined();
  });

  it('handles any arrangement of inputs', () => {
    const apiA: AnyApiFactory = {
      api: { id: 'a', T: undefined },
      deps: {},
      factory: () => 1,
    };

    const apiB: AnyApiFactory = {
      api: { id: 'b', T: undefined },
      deps: { ai: apiA.api },
      factory: ({ ai }) => (ai as any) + 1,
    };

    const apiC: AnyApiFactory = {
      api: { id: 'c', T: undefined },
      deps: { bi: apiB.api },
      factory: ({ bi }) => (bi as any) + 1,
    };

    const apiD: AnyApiFactory = {
      api: { id: 'd', T: undefined },
      deps: { bi: apiB.api },
      factory: ({ bi }) => (bi as any) + 1,
    };

    const apiE: AnyApiFactory = {
      api: { id: 'e', T: undefined },
      deps: { ci: apiC.api, di: apiD.api },
      factory: ({ ci, di }) => (ci as any) + (di as any),
    };

    for (const apis of allPermutations([apiA, apiB, apiC, apiD, apiE])) {
      const resolver = ApiResolver.with(apis);
      expect(resolver.resolve(apiE.api)).toBe(6);
    }
  });

  it('can register entries that have dependencies among themselves', () => {
    const apiB: AnyApiFactory = {
      api: { id: 'b', T: undefined },
      deps: {},
      factory: () => 1,
    };

    const apiA: AnyApiFactory = {
      api: { id: 'a', T: undefined },
      deps: { b: apiB.api },
      factory: ({ b }) => (b as any) + 1,
    };

    for (const apis of allPermutations([apiA, apiB])) {
      const resolver = ApiResolver.with(apis);
      expect(resolver.resolve(apiA.api)).toBe(2);
      expect(resolver.resolve(apiB.api)).toBe(1);
    }
  });

  it('can register entries that have dependencies on already registered things', () => {
    const apiB: AnyApiFactory = {
      api: { id: 'b', T: undefined },
      deps: {},
      factory: () => 1,
    };

    const resolver = ApiResolver.with([apiB]);

    const apiA: AnyApiFactory = {
      api: { id: 'a', T: undefined },
      deps: { bi: apiB.api },
      factory: ({ bi }) => (bi as any) + 1,
    };

    const resolver2 = resolver.with([apiA]);

    expect(resolver2.resolve(apiA.api)).toBe(2);
    expect(resolver2.resolve(apiB.api)).toBe(1);
  });

  it('rejects attempts to overwrite already registered things', () => {
    const apiA: AnyApiFactory = {
      api: { id: 'a', T: undefined },
      deps: {},
      factory: () => 1,
    };

    const resolver = ApiResolver.with([apiA]);

    const apiA2: AnyApiFactory = {
      api: { id: 'a', T: undefined },
      deps: {},
      factory: () => 2,
    };

    expect(() => resolver.with([apiA2])).toThrowErrorMatchingInlineSnapshot(
      '"API a was already registered"',
    );
  });

  it('rejects attempts to register dangling references', () => {
    const apiA: AnyApiFactory = {
      api: { id: 'a', T: undefined },
      deps: {},
      factory: () => 1,
    };

    const resolver = ApiResolver.with([apiA]);

    const apiB: AnyApiFactory = {
      api: { id: 'b', T: undefined },
      deps: { ai: apiA.api },
      factory: () => 2,
    };

    const apiC: AnyApiFactory = {
      api: { id: 'c', T: undefined },
      deps: { missing: { id: 'missing', T: undefined } },
      factory: () => undefined,
    };

    for (const apis of allPermutations([apiB, apiC])) {
      expect(() => resolver.with(apis)).toThrowErrorMatchingInlineSnapshot(
        '"Could not resolve API dependency in chain, c -> missing"',
      );
    }
  });

  it('rejects circular dependencies', () => {
    const apiA: AnyApiFactory = {
      api: { id: 'a', T: undefined },
      deps: { bi: { id: 'b', T: undefined } },
      factory: () => 1,
    };

    const apiB: AnyApiFactory = {
      api: { id: 'b', T: undefined },
      deps: { ai: { id: 'a', T: undefined } },
      factory: () => 2,
    };

    expect(() =>
      ApiResolver.with([apiA, apiB]),
    ).toThrowErrorMatchingInlineSnapshot(
      '"Circular API dependencies: a -> b -> a"',
    );
  });
});
