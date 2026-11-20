(function(global) {
  'use strict';

  function canAdvance(value, max) {
    var text = String(value);
    return text !== '-' && (text === '0' || text.length >= String(max).length || Number(text) * 10 > max);
  }

  function nextPos(row, column, rowCount, lastColumn, direction) {
    if (direction === 'col') {
      return row < rowCount - 1 ? [row + 1, column] : column < lastColumn ? [0, column + 1] : null;
    }
    return column < lastColumn ? [row, column + 1] : row < rowCount - 1 ? [row + 1, 0] : null;
  }

  function prevPos(row, column, rowCount, lastColumn, direction) {
    if (direction === 'col') {
      return row > 0 ? [row - 1, column] : column > 0 ? [rowCount - 1, column - 1] : null;
    }
    return column > 0 ? [row, column - 1] : row > 0 ? [row - 1, lastColumn] : null;
  }

  // A single hyphen is a deliberate non-participation marker.
  // Empty string remains a genuinely missing entry; zero remains a numeric score.
  function normalize(value) {
    var raw = String(value == null ? '' : value).trim();
    if (raw === '-') return '-';
    return raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  }

  function create(options) {
    return {
      canAdvance: canAdvance,
      next: function(row, column) {
        return nextPos(row, column, options.rowCount, options.lastColumn, options.direction());
      },
      previous: function(row, column) {
        return prevPos(row, column, options.rowCount, options.lastColumn, options.direction());
      },
      append: function(current, digit, max) {
        if (String(current || '') === '-') return { accepted: false, value: '-' };
        var candidate = normalize(String(current || '') + String(digit));
        if (candidate !== '' && candidate !== '-' && Number(candidate) > max) {
          return { accepted: false, value: normalize(current || '') };
        }
        return { accepted: true, value: candidate };
      },
      normalize: normalize,
      isNonParticipation: function(value) { return String(value == null ? '' : value).trim() === '-'; },
      isMissing: function(value) { return String(value == null ? '' : value).trim() === ''; }
    };
  }

  global.ScoreEntryEngine = { create: create, canAdvance: canAdvance, nextPos: nextPos, prevPos: prevPos, normalize: normalize };
})(window);
