/* DE-GLOBAL ACADEMY — Supabase Storage asset service
 * Uploads approved school assets to isolated public/private buckets.
 * Never accepts a school ID from the caller; it resolves the active profile.
 */
(function (global) {
  'use strict';

  var PUBLIC_BUCKET = 'school-public-assets';
  var PRIVATE_BUCKET = 'school-private-assets';
  var MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  var MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
  var IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  var DOCUMENT_TYPES = ['application/pdf'];

  function safeSegment(value) {
    return String(value || '').trim().toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  }

  function extensionFor(file) {
    var map = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
      'application/pdf': 'pdf'
    };
    return map[file.type] || '';
  }

  function create(client) {
    if (!client || !client.auth || !client.storage) {
      throw new Error('A valid Supabase client is required.');
    }

    async function activeAdministrator() {
      var auth = await client.auth.getUser();
      if (auth.error || !auth.data || !auth.data.user) {
        throw new Error('Sign in again before managing school files.');
      }
      var result = await client.from('profiles')
        .select('id,school_id,role,is_active')
        .eq('id', auth.data.user.id).maybeSingle();
      if (result.error) throw result.error;
      var p = result.data;
      if (!p || p.is_active !== true || !p.school_id ||
          String(p.role || '').toLowerCase() !== 'administrator') {
        throw new Error('An active school administrator account is required.');
      }
      return p;
    }

    async function upload(file, category, entityId, visibility) {
      if (!file || typeof file.size !== 'number') throw new Error('Choose a file first.');
      var isDocument = category === 'documents';
      var allowed = isDocument ? DOCUMENT_TYPES : IMAGE_TYPES;
      var limit = isDocument ? MAX_DOCUMENT_BYTES : MAX_IMAGE_BYTES;
      if (allowed.indexOf(file.type) === -1) {
        throw new Error(isDocument ? 'Only PDF documents are accepted.' : 'Use JPG, PNG or WebP images.');
      }
      if (file.size <= 0 || file.size > limit) {
        throw new Error('File size must be between 1 byte and ' + (limit / 1048576) + ' MB.');
      }

      var profile = await activeAdministrator();
      var categorySegment = safeSegment(category);
      var entitySegment = safeSegment(entityId || 'general');
      if (!categorySegment || !entitySegment) throw new Error('Invalid asset category or record identifier.');

      var bucket = visibility === 'public' ? PUBLIC_BUCKET : PRIVATE_BUCKET;
      var path = String(profile.school_id) + '/' + categorySegment + '/' +
        entitySegment + '/' + Date.now() + '-' +
        Math.random().toString(36).slice(2, 10) + '.' + extensionFor(file);

      var result = await client.storage.from(bucket).upload(path, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false
      });
      if (result.error) throw result.error;
      return { bucket: bucket, path: path, school_id: profile.school_id, content_type: file.type, size: file.size };
    }

    async function uploadPublicImage(file, category, entityId) {
      if (category === 'signatures' || category === 'passports') {
        throw new Error('Passports and signatures must never be uploaded as public assets.');
      }
      return upload(file, category, entityId, 'public');
    }

    async function uploadPrivateFile(file, category, entityId) {
      return upload(file, category, entityId, 'private');
    }

    async function createSignedUrl(path, category, expiresIn) {
      var profile = await activeAdministrator();
      var cleanPath = String(path || '');
      if (!cleanPath.startsWith(String(profile.school_id) + '/')) {
        throw new Error('The requested file is outside your school folder.');
      }
      var bucket = category === 'public' ? PUBLIC_BUCKET : PRIVATE_BUCKET;
      var result = await client.storage.from(bucket).createSignedUrl(cleanPath, expiresIn || 300);
      if (result.error) throw result.error;
      return result.data.signedUrl;
    }

    async function remove(path, visibility) {
      var profile = await activeAdministrator();
      var cleanPath = String(path || '');
      if (!cleanPath.startsWith(String(profile.school_id) + '/')) {
        throw new Error('The requested file is outside your school folder.');
      }
      var bucket = visibility === 'public' ? PUBLIC_BUCKET : PRIVATE_BUCKET;
      var result = await client.storage.from(bucket).remove([cleanPath]);
      if (result.error) throw result.error;
      return true;
    }

    return Object.freeze({
      uploadPublicImage: uploadPublicImage,
      uploadPrivateFile: uploadPrivateFile,
      createSignedUrl: createSignedUrl,
      remove: remove
    });
  }

  global.SupabaseSchoolAssets = Object.freeze({ create: create });
})(window);
