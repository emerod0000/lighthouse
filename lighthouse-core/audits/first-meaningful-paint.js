/**
 * @license Copyright 2016 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const Audit = require('./audit');
const Util = require('../report/v2/renderer/util');
const LHError = require('../lib/errors');

class FirstMeaningfulPaint extends Audit {
  /**
   * @return {!AuditMeta}
   */
  static get meta() {
    return {
      name: 'first-meaningful-paint',
      description: 'First meaningful paint',
      helpText: 'First meaningful paint measures when the primary content of a page is visible. ' +
          '[Learn more](https://developers.google.com/web/tools/lighthouse/audits/first-meaningful-paint).',
      scoreDisplayMode: Audit.SCORING_MODES.NUMERIC,
      requiredArtifacts: ['traces'],
    };
  }

  /**
   * Audits the page to give a score for First Meaningful Paint.
   * @see https://github.com/GoogleChrome/lighthouse/issues/26
   * @see https://docs.google.com/document/d/1BR94tJdZLsin5poeet0XoTW60M0SjvOJQttKT-JK8HI/view
   * @param {!Artifacts} artifacts The artifacts from the gather phase.
   * @param {LH.Audit.Context} context
   * @return {!Promise<!AuditResult>}
   */
  static audit(artifacts, context) {
    const trace = artifacts.traces[this.DEFAULT_PASS];
    return artifacts.requestTraceOfTab(trace).then(tabTrace => {
      if (!tabTrace.firstMeaningfulPaintEvt) {
        throw new LHError(LHError.errors.NO_FMP);
      }

      // navigationStart is currently essential to FMP calculation.
      // see: https://github.com/GoogleChrome/lighthouse/issues/753
      if (!tabTrace.navigationStartEvt) {
        throw new LHError(LHError.errors.NO_NAVSTART);
      }

      const result = this.calculateScore(tabTrace, context);

      return {
        score: result.score,
        rawValue: parseFloat(result.duration),
        displayValue: Util.formatMilliseconds(result.duration),
        debugString: result.debugString,
        extendedInfo: {
          value: result.extendedInfo,
        },
      };
    });
  }

  static calculateScore(traceOfTab, context) {
    // Expose the raw, unchanged monotonic timestamps from the trace, along with timing durations
    const extendedInfo = {
      timestamps: {
        navStart: traceOfTab.timestamps.navigationStart,
        fCP: traceOfTab.timestamps.firstContentfulPaint,
        fMP: traceOfTab.timestamps.firstMeaningfulPaint,
        onLoad: traceOfTab.timestamps.onLoad,
        endOfTrace: traceOfTab.timestamps.traceEnd,
      },
      timings: {
        navStart: 0,
        fCP: traceOfTab.timings.firstContentfulPaint,
        fMP: traceOfTab.timings.firstMeaningfulPaint,
        onLoad: traceOfTab.timings.onLoad,
        endOfTrace: traceOfTab.timings.traceEnd,
      },
      fmpFellBack: traceOfTab.fmpFellBack,
    };

    Object.keys(extendedInfo.timings).forEach(key => {
      const val = extendedInfo.timings[key];
      if (typeof val !== 'number' || Number.isNaN(val)) {
        extendedInfo.timings[key] = undefined;
        extendedInfo.timestamps[key] = undefined;
      } else {
        extendedInfo.timings[key] = parseFloat(extendedInfo.timings[key].toFixed(3));
      }
    });

    const firstMeaningfulPaint = traceOfTab.timings.firstMeaningfulPaint;
    const score = Audit.computeLogNormalScore(
      firstMeaningfulPaint,
      context.options.scorePODR,
      context.options.scoreMedian
    );

    return {
      score,
      duration: firstMeaningfulPaint.toFixed(1),
      rawValue: firstMeaningfulPaint,
      extendedInfo,
    };
  }
}

module.exports = FirstMeaningfulPaint;
